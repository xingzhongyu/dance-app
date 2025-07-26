# --- STAGE 1: Build ---
# 使用一个包含完整构建工具的Node.js镜像
FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /app

# 1. 声明一个构建时参数
ARG NEXT_PUBLIC_BACKEND_URL

# 2. 将这个构建参数设置为环境变量，以便后续的 RUN 命令可以访问
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}

# 复制 package.json 和 lock 文件
COPY package*.json ./

# 安装所有依赖
RUN npm install

# 复制所有源代码
COPY . .

# 执行生产构建 
RUN npm run build

# --- STAGE 2: Production ---
# 使用一个轻量的Node.js镜像来运行应用
FROM node:22-alpine

# 设置工作目录
WORKDIR /app

# 从'builder'阶段复制生产环境需要的依赖
# Next.js 12+ 推荐这种方式，而不是重新安装production依赖
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# 从'builder'阶段复制构建好的.next目录和public目录
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# 暴露Next.js运行的端口（默认为3001）
EXPOSE 3001

# 启动Next.js生产服务器的命令
CMD ["npm", "start"]