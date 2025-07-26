"use client";

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/context/AuthContext';
import { AxiosError } from 'axios';
import styles from '@/styles/Form.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setMessage('Password reset email has been sent, please check your inbox');
      setEmail('');
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError ? err.response?.data?.detail : 'Failed to send';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2>Forgot Password</h2>
        <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>
          Please enter your email address and we will send a password reset link to your inbox.
        </p>
        
        <div className={styles.formGroup}>
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}

        <button type="submit" className={styles.button} disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send Reset Email'}
        </button>

        <p className={styles.switchLink}>
          Remember your password? <Link href="/login">Back to Login</Link>
        </p>
      </form>
    </div>
  );
} 