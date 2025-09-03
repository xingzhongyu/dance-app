from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

class DatasetBase(BaseModel):
    tissue_info: str
    description: str

class DatasetCreate(DatasetBase):
    pass


class UserBase(BaseModel):
    username: str
    email: EmailStr  # 添加邮箱字段

class UserCreate(UserBase):
    password: str

class EmailVerification(BaseModel):
    token: str

class ResendVerification(BaseModel):
    email: EmailStr

class ForgotPassword(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str
    new_password: str


    
# --- 完整的 AtlasMetadata Schema ---
class AtlasMetadataBase(BaseModel):
    preview_image_url: Optional[str] = None
    postive_pattern_image_url: Optional[str] = None
    negative_pattern_image_url: Optional[str] = None
    postive_pattern_csv_url: Optional[str] = None
    negative_pattern_csv_url: Optional[str] = None
    # 基础元数据
    species: Optional[str] = None
    tissue: Optional[str] = None
    dataset_col: Optional[int] = None
    split: Optional[str] = None
    data_fname: Optional[str] = None
    data_url: Optional[str] = None
    dataset_name: Optional[str] = None
    dataset_id_col: Optional[str] = None
    
    # 数值统计数据
    unnamed_0: Optional[float] = None
    number_of_cells: Optional[float] = None
    number_of_genes: Optional[float] = None
    number_of_cell_types: Optional[float] = None
    number_of_non_zero_entries: Optional[float] = None
    cell: Optional[float] = None
    sampled_cell: Optional[float] = None
    
    # 细胞和疾病相关信息
    cell_type: Optional[str] = None
    disease_origin: Optional[str] = None
    tissuecta: Optional[str] = None
    cell_type_sampled: Optional[str] = None
    disease_sampled: Optional[str] = None
    assay: Optional[str] = None
    assay_sampled: Optional[str] = None
    dataset_idcta: Optional[str] = None
    queryed: Optional[str] = None

    # CTA Actinn 相关字段
    cta_actinn: Optional[str] = None
    cta_actinn_best_yaml: Optional[str] = None
    cta_actinn_best_res: Optional[float] = None
    cta_actinn_run_stats: Optional[str] = None
    cta_actinn_check: Optional[bool] = None
    cta_actinn_step2_best_yaml: Optional[str] = None
    cta_actinn_step2_best_res: Optional[float] = None
    
    # CTA Celltypist 相关字段
    cta_celltypist: Optional[str] = None
    cta_celltypist_best_yaml: Optional[str] = None
    cta_celltypist_best_res: Optional[float] = None
    cta_celltypist_run_stats: Optional[str] = None
    cta_celltypist_check: Optional[str] = None
    cta_celltypist_step2_best_yaml: Optional[str] = None
    cta_celltypist_step2_best_res: Optional[float] = None
    
    # CTA scDeepsort 相关字段
    cta_scdeepsort: Optional[str] = None
    cta_scdeepsort_best_yaml: Optional[str] = None
    cta_scdeepsort_best_res: Optional[float] = None
    cta_scdeepsort_run_stats: Optional[str] = None
    cta_scdeepsort_check: Optional[bool] = None
    cta_scdeepsort_step2_best_yaml: Optional[str] = None
    cta_scdeepsort_step2_best_res: Optional[float] = None
    
    # CTA SingleCellNet 相关字段
    cta_singlecellnet: Optional[str] = None
    cta_singlecellnet_best_yaml: Optional[str] = None
    cta_singlecellnet_best_res: Optional[float] = None
    cta_singlecellnet_run_stats: Optional[str] = None
    cta_singlecellnet_check: Optional[bool] = None
    cta_singlecellnet_step2_best_yaml: Optional[str] = None
    cta_singlecellnet_step2_best_res: Optional[float] = None

class AtlasMetadata(AtlasMetadataBase):
    id: int
    dataset_id: int

    class Config:
        orm_mode = True

        

# A. Add is_public to the Dataset schema
class Dataset(DatasetBase):
    id: int
    owner_id: int
    filename: str
    dataset_name: str
    upload_time: datetime
    is_public: bool # <-- Add this
    analyses: List['Analysis'] = []
    file_path:str
    is_atlas:bool
    atlas_metadata: Optional[AtlasMetadata] = None
    umap_csv_path: Optional[str] = None
    class Config:
        orm_mode = True

# B. Add is_admin to the User schema
class User(UserBase):
    id: int
    is_admin: bool # <-- Add this
    is_email_verified: bool  # 添加邮箱验证状态
    datasets: List[Dataset] = []

    class Config:
        orm_mode = True

class RegisterResponse(BaseModel):
    message: str
    user: User

        
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    

    # A. 新增 Analysis 的 Schema
class AnalysisBase(BaseModel):
    analysis_param: str
    image_urls: str

class AnalysisCreate(AnalysisBase):
    pass
        

# C. Update AnalysisResult to match new structure
class AnalysisResult(BaseModel):
    status: str
    # Image URLs are now optional
    image_urls: Optional[List[str]] = None
    # CSV URL is now included (and mandatory on success)
    csv_url: Optional[str] = None
    message: Optional[str] = None

# D. Update the Analysis schema
class Analysis(AnalysisBase):
    id: int
    dataset_id: int
    image_urls: Optional[str] = None # <-- Make optional
    csv_url: str # <-- Add this
    created_at: datetime

    class Config:
        # orm_mode = True
        from_attributes = True



        

class FunctionDownloadResult(BaseModel):
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None     
    
    
class FunctionDownloadRequest(BaseModel):
    dataset_id: str
    tissue_info: str 
class UmapPathResponse(BaseModel):
    id: int
    umap_csv_path: Optional[str]
# This is needed because Dataset and Analysis refer to each other
Dataset.update_forward_refs()
