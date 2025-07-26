import base64
import json
import time
import os
from typing import Optional
from dotenv import load_dotenv
import pandas as pd
import requests
import scanpy as sc
import matplotlib.pyplot as plt
from celery import Celery
import redis
import os
import time
import io  # <-- 新增：用于内存操作
import redis
import scanpy as sc
import matplotlib.pyplot as plt
import oss2 # <-- 新增：OSS SDK
from database import SessionLocal
import crud
# 创建结果保存目录
os.makedirs("analysis_results", exist_ok=True)
DEMO_URL=os.getenv("DEMO_URL",  "http://localhost:8100")
# API服务器的地址和端口
API_URL = DEMO_URL+"/api/get_similarity"
ATLAS_API_URL = DEMO_URL+"/api/get_method"
REDIS_URL = os.getenv("REDIS_URL","redis://localhost:6379/0")
# Celery 配置
celery_app = Celery(
    'tasks',
    broker=REDIS_URL,
    backend=REDIS_URL
)


load_dotenv()
# --- OSS 配置 (从环境变量读取，更安全) ---
OSS_ACCESS_KEY_ID = os.getenv("OSS_ACCESS_KEY_ID")
OSS_ACCESS_KEY_SECRET = os.getenv("OSS_ACCESS_KEY_SECRET")
OSS_ENDPOINT = os.getenv("OSS_ENDPOINT") # 例如 'oss-cn-hangzhou.aliyuncs.com'
OSS_BUCKET_NAME = os.getenv("OSS_BUCKET_NAME")

# 初始化 OSS Auth 和 Bucket
auth = oss2.Auth(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET)
bucket = oss2.Bucket(auth, OSS_ENDPOINT, OSS_BUCKET_NAME)

def upload_data_to_oss(data: bytes, object_name: str) -> str:
    """ Generic helper to upload bytes data to OSS. """
    bucket.put_object(object_name, data)
    return f"https://{OSS_BUCKET_NAME}.{OSS_ENDPOINT}/{object_name}"

def upload_plot_to_oss(fig, object_name: str) -> str:
    """
    将 matplotlib figure 对象上传到 OSS 并返回公开 URL
    :param fig: matplotlib 的 Figure 对象
    :param object_name: 在 OSS 中保存的文件路径，例如 'results/task123.png'
    :return: 公开可访问的 URL
    """
    # 1. 将图像保存到内存中的 BytesIO 对象
    buffer = io.BytesIO()
    fig.savefig(buffer, format='png', bbox_inches='tight') # bbox_inches='tight' 裁剪掉多余白边
    buffer.seek(0) # 重置指针到开头

    # 2. 上传到 OSS
    bucket.put_object(object_name, buffer)
    plt.close(fig) # 关闭 figure 释放内存

    # 3. 构建并返回公开 URL
    # 格式: https://<BucketName>.<Endpoint>/<ObjectName>
    public_url = f"https://{OSS_BUCKET_NAME}.{OSS_ENDPOINT}/{object_name}"
    return public_url
 

@celery_app.task(bind=True)
def run_analysis_task(self, h5ad_file_path: str,  csv_file_path: Optional[str], analysis_param: str, dataset_id: int,tissue_info:str):
    """
    一个耗时的分析任务，将结果图上传到OSS
    """
    # ... 你的任务逻辑现在可以使用 h5ad_file_path 和 csv_file_path
    
    self.update_state(state='PROGRESS', meta={'status': 'Loading data...'})
    # 例如，你现在可以同时读取两个文件
    # adata = sc.read_h5ad(h5ad_file_path)
     # B. Conditionally load CSV data
    sweep_dict = None
    if csv_file_path:
        sweep_dict = pd.read_csv(csv_file_path,index_col=0).to_dict()["sweep_id"]
        print(f"Loaded optional CSV from: {csv_file_path}")
    else:
        print("No optional CSV provided for this analysis.")

    self.update_state(state='PROGRESS', meta={'status': f'Running analysis with param: {analysis_param}...'})
    files = {
    'h5ad_file': (os.path.basename(h5ad_file_path), open(h5ad_file_path, 'rb'), 'application/octet-stream')
}
    h5ad_file_name=os.path.basename(h5ad_file_path)
    data = {
    'tissue': tissue_info,
    'feature_name': analysis_param, # 假设 analysis_param 是一个字符串
    'use_sim_cache': str(True), #布尔值转为字符串发送
    # 'query_dataset': (h5ad_file_name.split(tissue_info.capitalize())[1] +
    #                      (tissue_info.capitalize() + h5ad_file_name.split(tissue_info.capitalize())[2] if len(h5ad_file_name.split(tissue_info.capitalize())) >= 3 else '')
    #                      ).split('_')[0],
}
    if sweep_dict is not None:
        data['sweep_dict_json']=json.dumps(sweep_dict)
    response = requests.post(API_URL, files=files, data=data)

    # 检查请求是否成功
    response.raise_for_status()

    # 解析返回的JSON数据
    results = response.json()
    print("成功接收到API的响应！")

    # 处理返回的数据
    print("\n--- 元数据 ---")
    metadata_dict=results.get("metadata")
    self.update_state(state='PROGRESS', meta={'status': 'Generating CSV data...'})
    csv_buffer = io.StringIO()
    atlas_dataset_id=metadata_dict.get("dataset_id")
    del metadata_dict["dataset_id"]
    method_df=pd.DataFrame(metadata_dict.items(),columns=['Method','Preprocessing Step'])
    method_df.loc[:,"dataset_id"]=atlas_dataset_id
    method_df.to_csv(csv_buffer)
    csv_object_name = f"analysis_results/{self.request.id}_data.csv"
    csv_url = upload_data_to_oss(csv_buffer.getvalue().encode('utf-8'), csv_object_name)

    # --- 2. Generate and Upload Plots (Optional) ---
    self.update_state(state='PROGRESS', meta={'status': 'Generating plots...'})
    image_urls_list = []
    
        # 1. 处理第一张图
    b64_image1 = results.get("plot1_png_base64")
    if b64_image1:
        print("正在处理 plot1...")
        # 解码Base64字符串为二进制字节
        image1_bytes = base64.b64decode(b64_image1)
        
        # 定义在OSS上的对象名称
        plot1_object_name = f"analysis_results/{self.request.id}_plot1.png"
        
        # 上传到OSS
        print(f"正在上传 plot1 到 OSS: {plot1_object_name}")
        plot1_url = upload_data_to_oss(image1_bytes, plot1_object_name)
        
        if plot1_url:
            image_urls_list.append(plot1_url)
            print(f"Plot1 上传成功! URL: {plot1_url}")
        else:
            print("Plot1 上传失败。")
    
    # 2. 处理第二张图
    b64_image2 = results.get("plot2_png_base64")
    if b64_image2:
        print("\n正在处理 plot2...")
        # 解码
        image2_bytes = base64.b64decode(b64_image2)
        # 定义名称
        plot2_object_name = f"analysis_results/{self.request.id}_plot2.png"
        # 上传
        print(f"正在上传 plot2 到 OSS: {plot2_object_name}")
        plot2_url = upload_data_to_oss(image2_bytes, plot2_object_name)
        
        if plot2_url:
            image_urls_list.append(plot2_url)
            print(f"Plot2 上传成功! URL: {plot2_url}")
        else:
            print("Plot2 上传失败。")
    
    # 3. 打印最终结果
    print("\n--- 所有上传成功的图片URL ---")
    for url in image_urls_list:
        print(url)
    
    print("\n--- 原始元数据 ---")
    print(json.dumps(results.get("metadata"), indent=2))
        
    # except requests.exceptions.HTTPError as err:
    #     print(f"HTTP错误: {err}")
    #     print(f"响应内容: {response.text}")
    #     raise
    # except requests.exceptions.RequestException as e:
    #     print(f"请求失败: {e}")
    #     raise

    image_urls_str = ",".join(image_urls_list) if image_urls_list else None

    # --- 3. Save to Database ---
    db = SessionLocal()
    try:
        crud.create_analysis(
            db=db,
            dataset_id=dataset_id,
            param=analysis_param,
            csv_url=csv_url,
            image_urls=image_urls_str
        )
    finally:
        db.close()
    
    # Return everything for the status endpoint
    return {"status": "SUCCESS", "csv_url": csv_url, "image_urls": image_urls_str}


@celery_app.task(bind=True)
def get_atlas_method(self, atlas_dataset_id:str,tissue_info:str):
    response = requests.get(ATLAS_API_URL, params={"atlas_id": atlas_dataset_id,"tissue":tissue_info.lower()})
    return {"status": "SUCCESS","result":response.json()}