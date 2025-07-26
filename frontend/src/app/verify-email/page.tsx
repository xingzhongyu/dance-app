"use client";

import { Suspense } from "react";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/context/AuthContext';
import { AxiosError } from 'axios';
import styles from '@/styles/Form.module.css';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}

function VerifyEmailForm() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Verification link is invalid');
        return;
      }

      try {
        await api.post('/auth/verify-email', { token });
        setStatus('success');
        setMessage('Email verification successful! You can now login.');
      } catch (err: unknown) {
        setStatus('error');
        if (err instanceof AxiosError) {
          setMessage(err.response?.data?.detail || 'Verification failed, please try again later');
        } else {
          setMessage('Verification failed, please try again later');
        }
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className={styles.formContainer}>
      <div className={styles.form}>
        <h2>Email Verification</h2>
        
        {status === 'loading' && (
          <div className={styles.message}>
            <p>Verifying your email...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className={styles.message}>
            <p className={styles.success}>{message}</p>
            <Link href="/login" className={styles.button}>
              Go to Login
            </Link>
          </div>
        )}
        
        {status === 'error' && (
          <div className={styles.message}>
            <p className={styles.error}>{message}</p>
            <p>If you need to resend the verification email, please contact the administrator or register again.</p>
            <Link href="/login" className={styles.button}>
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 