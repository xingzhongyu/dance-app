"use client";
import { LogIn, LogOut, UserPlus } from 'lucide-react';
import styles from '../styles/Header.module.css';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const { user, logout, isLoading } = useAuth();
  
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <p>DANCE 2.0 Platform: Automated Optimal Preprocessing Recommendation for Single-Cell Data & Methods</p>
      </div>
      <div className={styles.userSection}>
        {isLoading ? (
          <div className={styles.loadingSpinner}></div>
        ) : user ? (
          <div className={styles.userInfo}>
            <span>Hello, {user.username}</span>
            <button onClick={logout} className={styles.authButton}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        ) : (
          <div className={styles.authActions}>
            <Link href="/login" className={styles.authButton}>
              <LogIn size={16} /> Login
            </Link>
            <Link href="/register" className={styles.authButtonSecondary}>
              <UserPlus size={16} /> Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
