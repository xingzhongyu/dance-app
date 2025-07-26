from typing import Optional
from sqlalchemy.orm import Session
import models, schemas, auth
from sqlalchemy import or_ # <-- Import 'or_'
from datetime import datetime, timedelta
from email_service import generate_verification_token, send_verification_email, send_password_reset_email

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    # 检查用户名和邮箱是否已存在
    if get_user_by_username(db, user.username):
        raise ValueError("用户名已存在")
    if get_user_by_email(db, user.email):
        raise ValueError("邮箱已被注册")
    
    hashed_password = auth.get_password_hash(user.password)
    
    # 生成验证令牌
    verification_token = generate_verification_token()
    expires = datetime.utcnow() + timedelta(hours=24)
    
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        email_verification_token=verification_token,
        email_verification_expires=expires
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # 发送验证邮件
    send_verification_email(user.email, user.username, verification_token)
    
    return db_user

def verify_email(db: Session, token: str):
    """验证邮箱地址"""
    user = db.query(models.User).filter(
        models.User.email_verification_token == token,
        models.User.email_verification_expires > datetime.utcnow()
    ).first()
    
    if not user:
        return None
    
    # 更新用户状态
    user.is_email_verified = True
    user.email_verification_token = None
    user.email_verification_expires = None
    db.commit()
    db.refresh(user)
    
    return user

def resend_verification_email(db: Session, email: str):
    """重新发送验证邮件"""
    user = get_user_by_email(db, email)
    if not user:
        return False
    
    if user.is_email_verified:
        return False
    
    # 生成新的验证令牌
    verification_token = generate_verification_token()
    expires = datetime.utcnow() + timedelta(hours=24)
    
    # 更新用户记录
    user.email_verification_token = verification_token
    user.email_verification_expires = expires
    db.commit()
    
    # 发送验证邮件
    return send_verification_email(user.email, user.username, verification_token)

def send_password_reset_email_crud(db: Session, email: str):
    """发送密码重置邮件"""
    user = get_user_by_email(db, email)
    if not user:
        return False
    
    # 生成密码重置令牌
    reset_token = generate_verification_token()
    expires = datetime.utcnow() + timedelta(hours=1)  # 1小时过期
    
    # 更新用户记录
    user.password_reset_token = reset_token
    user.password_reset_expires = expires
    db.commit()
    
    # 发送密码重置邮件
    return send_password_reset_email(user.email, user.username, reset_token)

def reset_password(db: Session, token: str, new_password: str):
    """重置密码"""
    user = db.query(models.User).filter(
        models.User.password_reset_token == token,
        models.User.password_reset_expires > datetime.utcnow()
    ).first()
    
    if not user:
        return None
    
    # 更新密码
    user.hashed_password = auth.get_password_hash(new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    db.commit()
    db.refresh(user)
    
    return user

def get_datasets_by_user(db: Session, user_id: int):
    """
    Fetches all datasets owned by the user AND all public datasets.
    """
    return db.query(models.Dataset).filter(
        or_(models.Dataset.owner_id == user_id, models.Dataset.is_public == True)
    ).order_by(models.Dataset.upload_time.desc()).all()

def create_analysis(db: Session, dataset_id: int, param: str, csv_url: str, image_urls: Optional[str] = None):
    """ Updated create_analysis function """
    db_analysis = models.Analysis(
        dataset_id=dataset_id,
        analysis_param=param,
        csv_url=csv_url,
        image_urls=image_urls
    )
    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)
    return db_analysis

def create_dataset(
    db: Session, 
    dataset: schemas.DatasetCreate, 
    filename: str, 
    h5ad_file_path: str, # More descriptive name
    user_id: int,
    csv_file_path: Optional[str]=None,  # Add new parameter
    is_public: bool = False,
    is_atlas: bool = False, 
    umap_csv_path: Optional[str] = None,
    dataset_name: str = None
):
    db_dataset = models.Dataset(
        **dataset.dict(), 
        filename=filename, 
        file_path=h5ad_file_path,
        csv_file_path=csv_file_path, # Save the new path
        owner_id=user_id,
        is_public=is_public,
        is_atlas=is_atlas,
        umap_csv_path=umap_csv_path,
        dataset_name=dataset_name
    )
    db.add(db_dataset)
    return db_dataset
    
def get_dataset_by_id(db: Session, dataset_id: int):
    return db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
def get_atlas_datasets(db: Session):
    return db.query(models.Dataset).filter(models.Dataset.is_atlas == True).all()
def delete_dataset(db: Session, dataset_id: int):
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if dataset:
        db.delete(dataset)
        db.commit()
        return True
    return False

# A. 新增查询 Analysis 的函数
def get_analysis_by_param(db: Session, dataset_id: int, analysis_param: str):
    return db.query(models.Analysis).filter(
        models.Analysis.dataset_id == dataset_id,
        models.Analysis.analysis_param == analysis_param
    ).first()


def get_atlas_dataset_by_id(db: Session, dataset_id: int):
    """
    通过 ID 获取单个 Atlas 数据集。
    使用 joinedload 来预加载关联的 AtlasMetadata，提高效率。
    """
    from sqlalchemy.orm import joinedload

    return db.query(models.Dataset).options(
        joinedload(models.Dataset.atlas_metadata) # 预加载元数据
    ).filter(
        models.Dataset.id == dataset_id,
        models.Dataset.is_atlas == True
    ).first()
def get_atlas_datasets_by_tissue(db: Session, tissue: str):
    """
    获取指定 tissue 下的所有数据集（包括私有和公共/Atlas）。
    """
    return db.query(models.Dataset).filter(
        models.Dataset.tissue_info == tissue,
        models.Dataset.is_atlas == True
    ).all()