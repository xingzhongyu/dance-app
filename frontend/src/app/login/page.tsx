"use client";

import { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Ensure Link is imported
import styles from '@/styles/Form.module.css';
import { api } from '@/context/AuthContext'; // Use our configured axios instance
import { AxiosError } from 'axios';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setShowResendVerification(false);
    setResendMessage('');
    
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      
      login(response.data.access_token);
      router.push('/datasets');
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError ? err.response?.data?.detail : 'Login failed';
      setError(errorMessage);
      
      if (errorMessage === '请先验证您的邮箱地址') {
        setShowResendVerification(true);
      }
    }
  };

  const handleResendVerification = async () => {
    if (!resendEmail) {
      setResendMessage('Please enter your email address');
      return;
    }

    try {
      await api.post('/auth/resend-verification', { email: resendEmail });
      setResendMessage('Verification email has been resent, please check your inbox');
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError ? err.response?.data?.detail : 'Failed to send';
      setResendMessage(errorMessage);
    }
  };

  return (
    <div className={styles.formContainer}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2>Welcome Back</h2>
        <div className={styles.formGroup}>
          <label htmlFor="username">Username</label>
          <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.button}>Login</button>
        
        {showResendVerification && (
          <div className={styles.resendVerification}>
            <p>Your email is not verified, please check your email or resend the verification email:</p>
            <div className={styles.formGroup}>
              <input
                type="email"
                placeholder="Enter your email address"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
              />
              <button type="button" onClick={handleResendVerification} className={styles.button}>
                Resend Verification Email
              </button>
            </div>
            {resendMessage && <p className={resendMessage.includes('success') ? styles.success : styles.error}>{resendMessage}</p>}
          </div>
        )}
        
        <p className={styles.switchLink}>
          No account yet? <Link href="/register">Register now</Link>
        </p>
        <p className={styles.switchLink}>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      </form>
    </div>
  );
}