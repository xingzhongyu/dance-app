"use client";

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/context/AuthContext'; // Use our configured axios instance
import { AxiosError } from 'axios';
import styles from '@/styles/Form.module.css'; // Use the common style created above

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // 1. Client-side validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    try {
      // 2. Send registration request to backend
      await api.post('/auth/register', {
        username,
        email,
        password,
      });

      // 3. Handle successful response
      setSuccess('Registration successful! Please check your email and click the verification link to complete registration.');
      
      // 清空表单
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');

    } catch (err: unknown) {
      // 4. Handle error response
      let errorMessage = 'Registration failed, please try again later';
      
      if (err instanceof AxiosError) {
        errorMessage = err.response?.data?.detail || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2>Create Account</h2>
        
        <div className={styles.formGroup}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

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

        <div className={styles.formGroup}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            minLength={6}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword">Confirm Password</label>
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

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}

        <button type="submit" className={styles.button} disabled={isLoading}>
          {isLoading ? 'Registering...' : 'Register'}
        </button>

        <p className={styles.switchLink}>
          Already have an account? <Link href="/login">Login now</Link>
        </p>
      </form>
    </div>
  );
}