"use client";

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/context/AuthContext'; // Use our configured axios instance
import { AxiosError } from 'axios';
import styles from '@/styles/Form.module.css'; // Use the common style created above

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 1. Client-side password validation
    if (password !== confirmPassword) {
      setError('The two passwords do not match');
      return;
    }

    try {
      // 2. Send registration request to backend
      await api.post('/auth/register', {
        username,
        password,
      });

      // 3. Handle successful response
      setSuccess('Registration successful! Redirecting to login page...');
      
      // Delay 2 seconds before redirecting, so user can see the success message
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (err: unknown) {
      // 4. Handle error response
      let errorMessage = 'Registration failed, please try again later.';
      
      if (err instanceof AxiosError) {
        errorMessage = err.response?.data?.detail || errorMessage;
      }
      
      setError(errorMessage);
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
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}

        <button type="submit" className={styles.button}>Register</button>

        <p className={styles.switchLink}>
          Already have an account? <Link href="/login">Log in now</Link>
        </p>
      </form>
    </div>
  );
}