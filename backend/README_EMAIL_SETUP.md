# 邮箱验证功能配置说明

## 概述
本系统已添加邮箱验证功能，用户注册后需要验证邮箱才能登录。

## 环境变量配置

在 `backend` 目录下创建 `.env` 文件，包含以下配置：

```bash
# 邮件服务器配置
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SENDER_EMAIL=your-email@gmail.com

# 前端URL（用于邮件中的链接）
FRONTEND_URL=http://omicsml.ai:81
```

## Gmail配置示例

1. 启用两步验证
2. 生成应用专用密码
3. 使用应用专用密码作为 `SMTP_PASSWORD`

## 其他邮件服务商

### QQ邮箱
```bash
SMTP_SERVER=smtp.qq.com
SMTP_PORT=587
SMTP_USERNAME=your-qq-email@qq.com
SMTP_PASSWORD=your-authorization-code
SENDER_EMAIL=your-qq-email@qq.com
```

### 163邮箱
```bash
SMTP_SERVER=smtp.163.com
SMTP_PORT=587
SMTP_USERNAME=your-163-email@163.com
SMTP_PASSWORD=your-authorization-code
SENDER_EMAIL=your-163-email@163.com
```

## 功能说明

### 注册流程
1. 用户填写用户名、邮箱、密码
2. 系统创建用户账户（未验证状态）
3. 发送验证邮件到用户邮箱
4. 用户点击邮件中的验证链接
5. 验证成功后可以登录

### 登录流程
1. 用户输入用户名和密码
2. 系统检查邮箱是否已验证
3. 如果未验证，显示重新发送验证邮件的选项
4. 验证通过后正常登录

### 邮箱验证页面
- 路径：`/verify-email?token=xxx`
- 自动处理验证链接
- 显示验证结果

## 数据库迁移

如果数据库已存在，需要手动添加新字段：

```sql
ALTER TABLE users ADD COLUMN email VARCHAR UNIQUE;
ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verification_token VARCHAR;
ALTER TABLE users ADD COLUMN email_verification_expires DATETIME;
```

## 测试

1. 启动后端服务
2. 注册新用户
3. 检查邮箱是否收到验证邮件
4. 点击验证链接
5. 尝试登录

## 故障排除

### 邮件发送失败
- 检查SMTP配置
- 确认邮箱服务商的应用专用密码
- 检查防火墙设置

### 验证链接无效
- 检查令牌是否过期（24小时）
- 确认前端URL配置正确

### 数据库错误
- 确保已添加新的数据库字段
- 检查数据库连接 