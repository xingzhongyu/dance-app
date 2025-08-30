from sqlalchemy import create_engine,text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/sql_app.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# sqlite  UPDATE users SET is_admin = true WHERE username = 'admin';