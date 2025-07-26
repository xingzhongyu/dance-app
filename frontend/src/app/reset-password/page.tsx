"use client";

import { Suspense } from "react";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/context/AuthContext';
import { AxiosError } from 'axios';
import styles from '@/styles/Form.module.css';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Reset link is invalid');
    } else {
      setStatus('form');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    const token = searchParams.get('token');

    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: newPassword
      });
      setStatus('success');
      setMessage('Password reset successful! You can now login with your new password.');
    } catch (err: unknown) {
      setStatus('error');
      if (err instanceof AxiosError) {
        setMessage(err.response?.data?.detail || 'Password reset failed');
      } else {
        setMessage('Password reset failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className={styles.formContainer}>
        <div className={styles.form}>
          <h2>Password Reset</h2>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.formContainer}>
        <div className={styles.form}>
          <h2>Password Reset</h2>
          <p className={styles.error}>{message}</p>
          <Link href="/forgot-password" className={styles.button}>
            Resend Reset Email
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className={styles.formContainer}>
        <div className={styles.form}>
          <h2>Password Reset</h2>
          <p className={styles.success}>{message}</p>
          <Link href="/login" className={styles.button}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContainer}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2>Set New Password</h2>
        <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>
          Please enter your new password
        </p>
        
        <div className={styles.formGroup}>
          <label htmlFor="newPassword">New Password</label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={isLoading}
            minLength={6}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword">Confirm New Password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
            minLength={6}
          />
        </div>

        {message && <p className={styles.error}>{message}</p>}

        <button type="submit" className={styles.button} disabled={isLoading}>
          {isLoading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
} 