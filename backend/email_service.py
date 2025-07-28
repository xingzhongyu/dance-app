import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import secrets
import string
from dotenv import load_dotenv
load_dotenv()
# 邮件配置
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "")

def generate_verification_token(length=32):
    """生成随机验证令牌"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def send_verification_email(email: str, username: str, token: str, base_url: str = "http://omicsml.ai:81"):
    """发送邮箱验证邮件"""
    if not all([SMTP_USERNAME, SMTP_PASSWORD, SENDER_EMAIL]):
        print("警告: 邮件配置不完整，跳过邮件发送")
        return False
    
    try:
        # 创建邮件内容
        verification_url = f"{base_url}/verify-email?token={token}"
        
        subject = "Verify Your Email Address"
        html_content = f"""
        <html>
        <body>
            <h2>Welcome {username}!</h2>
            <p>Thank you for registering with our service. Please click the link below to verify your email address:</p>
            <p><a href="{verification_url}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">Verify Email</a></p>
            <p>Or copy the following link to your browser:</p>
            <p>{verification_url}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you did not register for our service, please ignore this email.</p>
        </body>
        </html>
        """
        
        # 创建邮件
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SENDER_EMAIL
        msg['To'] = email
        
        # 添加HTML内容
        html_part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(html_part)
        
        # 发送邮件
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"发送邮件失败: {str(e)}")
        return False

def send_password_reset_email(email: str, username: str, token: str, base_url: str = "http://omicsml.ai:81"):
    """发送密码重置邮件"""
    if not all([SMTP_USERNAME, SMTP_PASSWORD, SENDER_EMAIL]):
        print("警告: 邮件配置不完整，跳过邮件发送")
        return False
    
    try:
        # 创建邮件内容
        reset_url = f"{base_url}/reset-password?token={token}"
        
        subject = "Reset Your Password"
        html_content = f"""
        <html>
        <body>
            <h2>Hello {username}!</h2>
            <p>We received a request to reset your password. Please click the link below to reset your password:</p>
            <p><a href="{reset_url}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
            <p>Or copy the following link to your browser:</p>
            <p>{reset_url}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request a password reset, please ignore this email.</p>
        </body>
        </html>
        """
        
        # 创建邮件
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SENDER_EMAIL
        msg['To'] = email
        
        # 添加HTML内容
        html_part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(html_part)
        
        # 发送邮件
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"发送邮件失败: {str(e)}")
        return False 