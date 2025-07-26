from sqlalchemy import Column, Integer, String, DateTime, ForeignKey,Boolean,Float
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)  # 添加邮箱字段
    hashed_password = Column(String)
    # A. Add an admin flag
    is_admin = Column(Boolean, default=False) 
    is_email_verified = Column(Boolean, default=False)  # 添加邮箱验证状态
    email_verification_token = Column(String, nullable=True)  # 邮箱验证令牌
    email_verification_expires = Column(DateTime, nullable=True)  # 验证令牌过期时间
    password_reset_token = Column(String, nullable=True)  # 密码重置令牌
    password_reset_expires = Column(DateTime, nullable=True)  # 密码重置令牌过期时间
    
    datasets = relationship("Dataset", back_populates="owner", cascade="all, delete-orphan")

class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_path = Column(String) # For .h5ad file
    dataset_name = Column(String, index=True)
    # A. Add a column for the CSV file path
    csv_file_path = Column(String, nullable=True) 
    
    tissue_info = Column(String)
    description = Column(String, nullable=True)
    upload_time = Column(DateTime, default=datetime.datetime.utcnow)
    is_public = Column(Boolean, default=False)
    is_atlas = Column(Boolean, default=False, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"))
    umap_csv_path = Column(String, nullable=True) # 允许为空，因为可能不是所有数据集都有
    
    owner = relationship("User", back_populates="datasets")
    analyses = relationship("Analysis", back_populates="dataset", cascade="all, delete-orphan")
    atlas_metadata = relationship("AtlasMetadata", back_populates="dataset", uselist=False, cascade="all, delete-orphan")

class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(Integer, primary_key=True, index=True)
    analysis_param = Column(String, index=True)
    
    # C. Make image_urls nullable (optional)
    image_urls = Column(String, nullable=True) 
    # D. Add a non-nullable csv_url
    csv_url = Column(String, nullable=False)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    dataset = relationship("Dataset", back_populates="analyses")
# --- 新增 AtlasMetadata 模型 ---
class AtlasMetadata(Base):
    __tablename__ = "atlas_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), unique=True, nullable=False)
    dataset = relationship("Dataset", back_populates="atlas_metadata")
    
    # --- 新增图片路径字段 ---
    preview_image_url = Column(String, nullable=True)
    postive_pattern_image_url = Column(String, nullable=True)
    negative_pattern_image_url = Column(String, nullable=True)
    postive_pattern_csv_url = Column(String, nullable=True)
    negative_pattern_csv_url = Column(String, nullable=True)
    # --- 以下是根据你的列表生成的完整字段 ---
    # 所有字段都设置为 nullable=True，以增加数据填充的灵活性
    
    # 基础元数据
    species = Column(String, nullable=True)
    tissue = Column(String, nullable=True)
    dataset_col = Column(Integer, nullable=True)  # 'dataset' 是关键字，已重命名
    split = Column(String, nullable=True)
    data_fname = Column(String, nullable=True)
    data_url = Column(String, nullable=True)
    dataset_name = Column(String, nullable=True)
    dataset_id_col = Column(String, nullable=True) # 'dataset_id' 与主键冲突，已重命名
    
    # 数值统计数据 (float64 -> Float)
    unnamed_0 = Column(Float, nullable=True) # "Unnamed: 0"
    number_of_cells = Column(Float, nullable=True)
    number_of_genes = Column(Float, nullable=True)
    number_of_cell_types = Column(Float, nullable=True)
    number_of_non_zero_entries = Column(Float, nullable=True) # 'Number of Non-Zero Entries in X'
    cell = Column(Float, nullable=True)
    sampled_cell = Column(Float, nullable=True)
    
    # 细胞和疾病相关信息
    cell_type = Column(String, nullable=True)
    disease_origin = Column(String, nullable=True)
    tissuecta = Column(String, nullable=True)
    cell_type_sampled = Column(String, nullable=True) # 'cell_type (sampled)'
    disease_sampled = Column(String, nullable=True)
    assay = Column(String, nullable=True)
    assay_sampled = Column(String, nullable=True)
    dataset_idcta = Column(String, nullable=True)
    queryed = Column(String, nullable=True) # "queryed" 拼写可能为 queried? 保持原样

    # CTA Actinn 相关字段
    cta_actinn = Column(String, nullable=True)
    cta_actinn_best_yaml = Column(String, nullable=True)
    cta_actinn_best_res = Column(Float, nullable=True)
    cta_actinn_run_stats = Column(String, nullable=True)
    cta_actinn_check = Column(Boolean, nullable=True)
    cta_actinn_step2_best_yaml = Column(String, nullable=True)
    cta_actinn_step2_best_res = Column(Float, nullable=True)
    
    # CTA Celltypist 相关字段
    cta_celltypist = Column(String, nullable=True)
    cta_celltypist_best_yaml = Column(String, nullable=True)
    cta_celltypist_best_res = Column(Float, nullable=True)
    cta_celltypist_run_stats = Column(String, nullable=True)
    cta_celltypist_check = Column(String, nullable=True) # 注意：dtype 是 object，这里用 String
    cta_celltypist_step2_best_yaml = Column(String, nullable=True)
    cta_celltypist_step2_best_res = Column(Float, nullable=True)
    
    # CTA scDeepsort 相关字段
    cta_scdeepsort = Column(String, nullable=True)
    cta_scdeepsort_best_yaml = Column(String, nullable=True)
    cta_scdeepsort_best_res = Column(Float, nullable=True)
    cta_scdeepsort_run_stats = Column(String, nullable=True)
    cta_scdeepsort_check = Column(Boolean, nullable=True)
    cta_scdeepsort_step2_best_yaml = Column(String, nullable=True)
    cta_scdeepsort_step2_best_res = Column(Float, nullable=True)
    
    # CTA SingleCellNet 相关字段
    cta_singlecellnet = Column(String, nullable=True)
    cta_singlecellnet_best_yaml = Column(String, nullable=True)
    cta_singlecellnet_best_res = Column(Float, nullable=True)
    cta_singlecellnet_run_stats = Column(String, nullable=True)
    cta_singlecellnet_check = Column(Boolean, nullable=True)
    cta_singlecellnet_step2_best_yaml = Column(String, nullable=True)
    cta_singlecellnet_step2_best_res = Column(Float, nullable=True)