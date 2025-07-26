import json
import os
import shutil
from typing import List, Optional
from datetime import timedelta

import anndata
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pandas as pd
from sqlalchemy.orm import Session
from celery.result import AsyncResult
import uvicorn
import crud, models, schemas, auth
from database import SessionLocal, engine
from celery_worker import get_atlas_method, run_analysis_task

# 创建数据库表
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- CORS 中间件 ---
# 允许前端(localhost:3000)访问
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://43.153.52.246:81",
    "http://omicsml.ai:81"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 静态文件服务 ---
# 用户上传的文件
os.makedirs("user_uploads", exist_ok=True)
app.mount("/user_uploads", StaticFiles(directory="user_uploads"), name="user_uploads")
# 分析结果图片
os.makedirs("analysis_results", exist_ok=True)
app.mount("/static_results", StaticFiles(directory="analysis_results"), name="static_results")
app.mount("/umaps", StaticFiles(directory="umaps"), name="umaps")
# app.mount("/static",StaticFiles(directory="/home/common1/zyxing/scGPT/data/cellxgene/example_data_dataset/sample-embedding_v4_large_sampled"), name="atlas_umap")
app.mount("/atlas_pattern",StaticFiles(directory="atlas_pngs"), name="atlas_pattern")
app.mount("/atlas_pattern_csv",StaticFiles(directory="atlas_heads"), name="atlas_pattern_csv")
with open("gene_maps.json", "r") as f:
    gene_maps = json.load(f)
# --- 依赖 ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(auth.oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except auth.JWTError:
        raise credentials_exception
    user = crud.get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

# --- 路由 ---
@app.post("/api/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return crud.create_user(db=db, user=user)

@app.post("/api/auth/login", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=schemas.User)
async def read_users_me(current_user: schemas.User = Depends(get_current_user)):
    return current_user

@app.post("/api/datasets/upload")
async def upload_dataset(
    # A. Expect two files now
    h5ad_file: UploadFile = File(...),
    csv_file: Optional[UploadFile] = File(None), 
    
    # B. is_public is an optional form field, default to False
    is_public: bool = Form(False),
    
    tissue_info: str = Form(...),
    dataset_name: str = Form(...),
    description: str = Form(...),
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    # C. Security check remains the same
    if is_public and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can upload public datasets.")
        
    # Optional: Validate file extensions
    if not h5ad_file.filename.endswith('.h5ad'):
        raise HTTPException(status_code=400, detail="Invalid H5AD file format.")
    # if not csv_file.filename.endswith('.csv'):
    #     raise HTTPException(status_code=400, detail="Invalid CSV file format.")

    # D. Create user-specific directory and save both files
    user_upload_dir = os.path.join("user_uploads", str(current_user.id))
    os.makedirs(user_upload_dir, exist_ok=True)
    
    # Save .h5ad file
    h5ad_file_path = os.path.join(user_upload_dir, h5ad_file.filename)
    with open(h5ad_file_path, "wb") as buffer:
        shutil.copyfileobj(h5ad_file.file, buffer)
    # 处理h5ad文件 - 将obs_names从ensemble ID映射到整数索引
    try:
        # 读取h5ad文件
        adata = anndata.read_h5ad(h5ad_file_path)
        
        # 应用映射 - 将obs_names从ensemble ID转换为整数索引
        new_var_names = [gene_maps.get(name, name) for name in adata.var_names]
        adata.var_names = pd.Index(new_var_names)
        
        # 保存修改后的文件
        processed_filename = h5ad_file.filename
        processed_file_path = os.path.join(user_upload_dir, processed_filename)
        adata.write_h5ad(processed_file_path)
        
        # 使用处理后的文件路径
        h5ad_file_path = processed_file_path
    except Exception as e:
        # 如果处理失败，记录错误但继续使用原始文件
        print(f"Error processing h5ad file: {str(e)}")
    
    
    
    # B. Conditionally save .csv file
    csv_file_path = None
    if csv_file:
        # Validate CSV file if it exists
        if not csv_file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Invalid CSV file format.")
        base_filename, _ = os.path.splitext(h5ad_file.filename)
        csv_filename = f"{base_filename}.csv"
        csv_file_path = os.path.join(user_upload_dir, csv_filename)
        with open(csv_file_path, "wb") as buffer:
            shutil.copyfileobj(csv_file.file, buffer)
        
    # E. Call the updated CRUD function
    dataset_data = schemas.DatasetCreate(tissue_info=tissue_info, description=description)
    db_dataset=crud.create_dataset(
        db=db, 
        dataset=dataset_data, 
        filename=h5ad_file.filename, # We use the h5ad filename as the primary name
        h5ad_file_path=h5ad_file_path,
        csv_file_path=csv_file_path,
        user_id=current_user.id,
        is_public=is_public,
        dataset_name=dataset_name
    )
    db.commit()
    db.refresh(db_dataset)
    return {"message": f"Files for '{h5ad_file.filename}' uploaded successfully"}

@app.get("/api/datasets", response_model=List[schemas.Dataset])
async def get_user_datasets(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    return crud.get_datasets_by_user(db, user_id=current_user.id)

# --- 接口 1: 启动功能下载任务 ---
@app.post("/api/atlas/function-download")
async def start_function_download(request_data: schemas.FunctionDownloadRequest):
    """
    启动一个异步任务来获取 atlas method function。
    """
    dataset_id = request_data.dataset_id
    tissue_info = request_data.tissue_info
    task = get_atlas_method.delay(dataset_id,tissue_info)
    return {"task_id": task.id, "status": "PENDING"}

# --- 接口 2: 查询任务状态 ---
@app.get("/api/atlas/function-download/status/{task_id}", response_model=schemas.FunctionDownloadResult)
async def get_function_download_status(task_id: str):
    """
    根据 task_id 查询任务的状态和结果。
    """
    task_result = AsyncResult(task_id)
    if task_result.state == 'SUCCESS':
        # 假设任务成功时返回一个字典，如 {"result_url": "..."}
        return {"status": "SUCCESS", "result": task_result.result}
    elif task_result.state == 'FAILURE':
        return {"status": "FAILURE", "error": str(task_result.info)}
    else: # PENDING, PROGRESS, etc.
        return {"status": task_result.state}


@app.post("/api/analysis/start/{dataset_id}")
async def start_analysis(
    dataset_id: int,
    analysis_param: str = Form(...),
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    # 1. 获取数据集
    dataset = crud.get_dataset_by_id(db, dataset_id=dataset_id)

    # 2. 检查数据集是否存在
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # A. --- 关键的权限检查修改 ---
    # 检查用户是否有权分析此数据集。
    # 条件：用户必须是数据集的所有者，或者该数据集是公共的。
    is_owner = (dataset.owner_id == current_user.id)
    if not is_owner and not dataset.is_public:
        raise HTTPException(
            status_code=403, 
            detail="Access denied. You can only analyze your own or public datasets."
        )
    
    # 3. 检查数据库中是否已有分析结果
    existing_analysis = crud.get_analysis_by_param(
        db, dataset_id=dataset_id, analysis_param=analysis_param
    )
    if existing_analysis:
        # B. --- 修复缓存/已存在结果的返回格式 ---
        # 确保返回的数据结构与新分析完成时一致
        image_urls = existing_analysis.image_urls.split(',') if existing_analysis.image_urls else []
        return {
            "task_id": None, 
            "status": "CACHED", 
            "image_urls": image_urls,
            "csv_url": existing_analysis.csv_url # <-- 之前缺失了这一项
        }

    # 4. 启动异步任务
    # C. --- 优化 Celery 调用 ---
    # `user_id` 在分析任务中不是必需的，因为分析结果只与数据集和参数有关
    task = run_analysis_task.delay(
        dataset.file_path, 
        dataset.csv_file_path, # <-- 把 csv 路径也传给 worker
        analysis_param, 
        dataset.id,
        dataset.tissue_info
    )
    return {"task_id": task.id, "status": "STARTED"}

@app.get("/api/analysis/status/{task_id}", response_model=schemas.AnalysisResult)
async def get_analysis_status(task_id: str):
    task_result = AsyncResult(task_id)
    if task_result.state == 'PENDING':
        return {"status": "PENDING", "message": "Task is waiting to be executed."}
    elif task_result.state == 'PROGRESS':
        return {"status": "PROGRESS", "message": task_result.info.get('status', '')}
    elif task_result.state == 'SUCCESS':
        # D. --- 确保返回格式与 Schema 一致 ---
        result_data = task_result.result
        image_urls_str = result_data.get('image_urls')
        return {
            "status": "SUCCESS", 
            "image_urls": image_urls_str.split(',') if image_urls_str else [],
            "csv_url": result_data.get('csv_url')
        }
    else:
        return {"status": "FAILURE", "message": str(task_result.info)}
@app.get("/api/datasets/{dataset_id:int}", response_model=schemas.Dataset)
async def get_dataset_by_id(dataset_id: int, db: Session = Depends(get_db)):
    dataset = crud.get_dataset_by_id(db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset
@app.delete("/api/datasets/{dataset_id}")
async def delete_dataset_endpoint(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    dataset = crud.get_dataset_by_id(db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # E. --- 优化删除权限 ---
    # 允许所有者或管理员删除数据集
    if dataset.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this dataset")

    # 在删除数据库记录前，先删除关联的 OSS 图片
    from celery_worker import bucket 
    for analysis in dataset.analyses:
        # 删除 CSV 文件
        if analysis.csv_url:
            csv_object_name = analysis.csv_url.split(f"https://{bucket.bucket_name}.{bucket.endpoint}/")[-1]
            try:
                bucket.delete_object(csv_object_name)
            except Exception as e:
                print(f"Failed to delete {csv_object_name} from OSS: {e}")
        
        # 删除图片文件
        if analysis.image_urls:
            urls = analysis.image_urls.split(',')
            for url in urls:
                if not url: continue
                img_object_name = url.split(f"https://{bucket.bucket_name}.{bucket.endpoint}/")[-1]
                try:
                    bucket.delete_object(img_object_name)
                except Exception as e:
                    print(f"Failed to delete {img_object_name} from OSS: {e}")

    # 删除本地上传的 h5ad 和 csv 文件
    if os.path.exists(dataset.file_path):
        os.remove(dataset.file_path)
    if dataset.csv_file_path and os.path.exists(dataset.csv_file_path):
        os.remove(dataset.csv_file_path)

    # 删除数据库中的 Dataset 记录 (级联删除分析记录)
    crud.delete_dataset(db, dataset_id=dataset_id)
    
    return {"message": "Dataset and all associated analysis results deleted successfully"}
# 添加一个新的路由，它不需要用户登录即可访问
@app.get("/api/datasets/atlas", response_model=List[schemas.Dataset])
async def get_all_atlas_datasets(db: Session = Depends(get_db)):
    """获取所有公开的 Atlas 数据集"""
    datasets = crud.get_atlas_datasets(db)
    return datasets

@app.get("/api/datasets/single_atlas/{dataset_id}", response_model=schemas.Dataset)
async def get_single_atlas_dataset(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    """获取单个 Atlas 数据集的详细信息"""
    db_dataset = crud.get_atlas_dataset_by_id(db, dataset_id=dataset_id)
    if not db_dataset:
        raise HTTPException(status_code=404, detail="Atlas dataset not found")
    return db_dataset
@app.get("/api/datasets/umaps_by_tissue/{tissue}", response_model=List[schemas.UmapPathResponse])
async def get_umaps_by_tissue(tissue: str, db: Session = Depends(get_db)):
    """
    根据 tissue 名称，获取该 tissue 下所有数据集的 ID 和 umap_csv_path。
    包括用户自己的和公共的/Atlas的。
    """
    # 这里我们假设 get_datasets_by_tissue 是一个新的 CRUD 函数
    datasets = crud.get_atlas_datasets_by_tissue(db, tissue=tissue)
    return [{"id": d.id, "umap_csv_path": d.umap_csv_path} for d in datasets]

@app.get("/api/datasets/atlas_metadata/{dataset_id:str}", response_model=schemas.Dataset)
async def get_atlas_metadata(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """获取Atlas数据集的元数据"""
    target_dataset = db.query(models.Dataset).join(models.AtlasMetadata, isouter=True).filter(
        models.Dataset.is_atlas == True,
        models.Dataset.filename == f"{dataset_id}.h5ad"
    ).first()
    
    if not target_dataset:
        raise HTTPException(status_code=404, detail="Atlas dataset not found")
    return target_dataset

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8005)