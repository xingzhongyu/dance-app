# 使用官方的Python基础镜像
FROM python:3.11-slim


RUN apt-get update && \
    apt-get install -y sqlite3 --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*


# 设置工作目录
WORKDIR /app

# 复制依赖文件并安装依赖
# 这样做可以利用Docker的层缓存，只有在requirements.txt改变时才重新安装
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt

# 复制所有后端代码到工作目录
COPY . /app

# 暴露FastAPI运行的端口（假设是8005）
EXPOSE 8005

# 启动应用的命令
# 使用 0.0.0.0 是为了让容器外的请求可以访问到它
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8005"]