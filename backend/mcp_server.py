
import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
import json
import os
import shutil
from typing import List, Optional, Dict
import anndata
from fastapi import Depends, FastAPI
import requests
import pandas as pd
from sqlalchemy.orm import Session
from fastmcp import Context, FastMCP
from fastmcp.server.dependencies import get_context
import tqdm
import urllib
import scanpy as sc

import crud, schemas
from database import SessionLocal
from celery.result import AsyncResult
from celery_worker import celery_app, run_analysis_task

mcp = FastMCP(
    "Bioinformatics Analysis Server",
    instructions="一个提供单细胞数据分析工具的服务器。",
)

mcp_app = mcp.http_app(path='/mcp')
@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
# Combine both lifespans
@asynccontextmanager
async def app_lifespan(app: FastAPI):
    # Startup: 在这里初始化数据库连接池
    print("Starting up the app... Initializing database pool.")
    yield
    # Shutdown: 在这里关闭数据库连接池
    print("Shutting down the app... Disposing database pool.")
# 组合两个 lifespan
@asynccontextmanager
async def combined_lifespan(app: FastAPI):
    async with app_lifespan(app):
        async with mcp_app.lifespan(app):
            yield





@mcp.resource("dataset://")
async def list_datasets() -> List[schemas.Dataset]:
    """从数据库中列出所有可用的数据集。"""
    # 从生命周期上下文中获取数据库会话
    json_datasets = []
    with get_db() as db:
        datasets = crud.get_atlas_datasets(db=db)
        for dataset in datasets:
            json_datasets.append(dataset.__dict__)
        return json_datasets


@mcp.resource("dataset://{dataset_id}")
async def get_dataset(dataset_id: str,ctx:Context) -> dict:
    
    """
    Retrieves detailed information for a specific dataset by its ID.
    """
    with get_db() as db:
        dataset = crud.get_dataset_by_id(db=db, dataset_id=dataset_id)
        if not dataset:
            raise ValueError(f"Dataset with ID {dataset_id} not found.")
        return dataset.__dict__


# --- MCP Tools ---
# Tools allow the LLM to perform actions. They are like POST endpoints.
with open("gene_maps.json", "r") as f:
    gene_maps = json.load(f)

def download_file(url, path):
    """Download a file given the url to the specified path.

    Parameters
    ----------
    url
        URL from which the data will be downloaded.
    path
        Path to which the downloaded data will be written.

    """
    import os
    os.environ["http_proxy"] = "http://121.250.209.147:7890"
    os.environ["https_proxy"] = "http://121.250.209.147:7890"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        u = urllib.request.urlopen(url)
        f = open(path, "wb")
        meta = u.info()
        file_size = int(meta.get("Content-Length", 0))

        file_size_dl = 0
        block_sz = 8192
        with tqdm.tqdm(total=file_size, unit="B", unit_scale=True, unit_divisor=1024) as bar:
            while True:
                buffer = u.read(block_sz)
                if not buffer:
                    break
                file_size_dl += len(buffer)
                f.write(buffer)
                bar.update(len(buffer))
        f.close()
        u.close()
        return True
    else:
        return False


@mcp.tool
async def register_dataset(
    # A. Expect two files now
    h5ad_file_url: str,
    tissue_info: str,
    dataset_name: str,
    description: str,
) -> dict:
    """
    Registers a new dataset from files and saves its metadata to the database.
    """
     # D. Create user-specific directory and save both files
    ctx=get_context()
    base_upload_dir = "/uploads" 
    user_upload_dir = os.path.join(base_upload_dir, 'llm')
    os.makedirs(user_upload_dir, exist_ok=True)
    # Save .h5ad file
    h5ad_file_path = os.path.join(user_upload_dir, dataset_name+".h5ad")
    download_file(h5ad_file_url, h5ad_file_path)
    
    # 处理h5ad文件 - 将obs_names从ensemble ID映射到整数索引
    try:
        # 读取h5ad文件
        adata = anndata.read_h5ad(h5ad_file_path)
        
        # 应用映射 - 将obs_names从ensemble ID转换为整数索引
        new_var_names = [gene_maps.get(name, name) for name in adata.var_names]
        adata.var_names = pd.Index(new_var_names)
        
        # 保存修改后的文件
        processed_filename = dataset_name+".h5ad"
        processed_file_path = os.path.join(user_upload_dir, processed_filename)
        adata.write_h5ad(processed_file_path)
        
        # 使用处理后的文件路径
        h5ad_file_path = processed_file_path
    except Exception as e:
        # 如果处理失败，记录错误但继续使用原始文件
        raise Exception(f"Error processing h5ad file: {str(e)}")

    dataset_to_create = schemas.DatasetCreate(
        description=description,
        tissue_info=tissue_info,
    )
    await ctx.info(f"正在注册数据集 {dataset_name}...")
    with get_db() as db:
        new_dataset = crud.create_dataset(db=db, dataset=dataset_to_create, filename=dataset_name+".h5ad", 
        h5ad_file_path=h5ad_file_path,
        user_id= -2 ,
        is_public=True,
        dataset_name=dataset_name)
        db.commit()
        db.refresh(new_dataset)
        await ctx.info(f"数据集 {dataset_name} 注册成功，ID: {new_dataset.id}")
        return new_dataset.__dict__



@mcp.tool
async def start_analysis(
    dataset_id: int,
    analysis_param: str,
    ctx: Context,
) -> dict:
    """
    对数据库中指定的某个数据集启动生物信息学分析。

    此工具会触发一个后台 Celery 任务，并实时轮询其状态，
    通过 MCP 进度更新将分析进展反馈给客户端。
    """
    with get_db() as db:
        dataset = crud.get_dataset_by_id(db=db, dataset_id=dataset_id)
        if not dataset:
            raise ValueError(f"未找到 ID 为 {dataset_id} 的数据集。")
        existing_analysis = crud.get_analysis_by_param(
        db, dataset_id=dataset_id, analysis_param=analysis_param
    )
    if existing_analysis:
        return schemas.Analysis.model_validate(existing_analysis).__dict__

    # 1. 启动 Celery 后台任务
    # ========================
    await ctx.info(f"正在为数据集 {dataset_id} 启动后台分析任务...")
    task = run_analysis_task.delay(
        h5ad_file_path=dataset.file_path,
        csv_file_path=dataset.csv_file_path,
        analysis_param=analysis_param,
        dataset_id=dataset_id,
        tissue_info=dataset.tissue_info,
    )
    task_result = AsyncResult(task.id, app=celery_app)
    await ctx.info(f"任务已启动，ID: {task.id}。正在等待任务开始...")

    # 2. 异步轮询任务状态，并报告进度
    # ==============================
    last_status = ""
    while not task_result.ready():
        # 获取任务状态
        state = task_result.state
        info = task_result.info or {} # info 可能为 None

        if state == 'PROGRESS':
            # 从 Celery worker 的 meta 中提取状态信息
            status_message = info.get('status', '正在处理...')
            if status_message != last_status:
                await ctx.info(status_message) # 使用 info 日志级别发送详细状态
                # 你也可以设计一个从 0.0 到 1.0 的进度值，并在这里报告
                # await ctx.report_progress(progress=..., message=status_message)
                last_status = status_message
        elif state == 'PENDING':
            # 任务正在等待 worker 接收
            pass # 可以选择性地发送 "任务排队中..." 的消息
        else:
            # 其他中间状态 (如 RETRY, STARTED)
            await ctx.debug(f"任务状态更新: {state}")

        # 非阻塞地等待
        await asyncio.sleep(2) # 每 2 秒检查一次状态

    # 3. 任务完成，处理最终结果
    # ==========================
    if task_result.successful():
        await ctx.info("分析任务成功完成！")
        final_result = task_result.get() # 获取任务的返回值

        # 将 Celery 任务返回的字典适配为 Pydantic 模型
        # 假设 Celery 任务返回 {"image_urls": "url1,url2", "csv_url": "url3"}
        image_urls_list = []
        if final_result.get("image_urls"):
            image_urls_list = final_result["image_urls"].split(',')

        return schemas.AnalysisResult(
            image_urls=image_urls_list,
            csv_url=final_result.get("csv_url", "")
        ).__dict__
    else:
        # 任务失败
        await ctx.error("分析任务失败。")
        error_info = str(task_result.info) # 获取异常信息
        # 在 MCP 中，应该抛出异常而不是返回错误对象
        raise Exception(f"后台分析任务失败: {error_info}")


# 同样地，get_atlas_method 也可以进行类似的改造
@mcp.tool
async def get_atlas_method(
    tissue_info: str,
    atlas_dataset_id: str, # 假设这是从某个地方获取的
    ctx: Context,
) -> dict:
    """
    通过后台任务获取 Atlas 分析方法。
    """
    from celery_worker import get_atlas_method as get_atlas_method_task

    await ctx.info(f"正在为组织 '{tissue_info}' 获取 Atlas 方法...")
    task = get_atlas_method_task.delay(
        atlas_dataset_id=atlas_dataset_id,
        tissue_info=tissue_info
    )
    task_result = AsyncResult(task.id, app=celery_app)

    # 等待任务完成（对于这种快速的 API 调用，可以直接等待）
    # 注意：.get() 是阻塞的，但在异步函数中我们应该避免它。
    # 更好的方式是也使用轮询，或者如果任务非常快，可以设置一个超时。
    while not task_result.ready():
        await asyncio.sleep(0.5) # 短暂等待

    if task_result.successful():
        result = task_result.get()
        await ctx.info("成功获取 Atlas 方法。")
        # result 已经是 {"status": "SUCCESS", "result": ...}
        return result.get("result", {})
    else:
        error_info = str(task_result.info)
        raise Exception(f"获取 Atlas 方法失败: {error_info}")
