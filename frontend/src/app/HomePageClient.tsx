"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useAuth } from '@/context/AuthContext';
import UploadForm from '@/components/UploadForm';
import styles from '@/styles/Home.module.css';

// This component receives markdown content from the server component as a prop
export default function HomePageClient({ markdownContent }: { markdownContent: string }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // useEffect handles side effects after authentication state changes (e.g., page redirect)
  useEffect(() => {
    // If data is still loading, do nothing
    if (isLoading) {
      return;
    }
    // If loading is complete but user is not logged in, redirect to login page
    if (!user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Show a loading message or redirect tip during loading/redirect to prevent content flicker
  if (isLoading || !user) {
    return (
        <div className={styles.container}>
            <p>Loading or redirecting...</p>
        </div>
    );
  }
  
  // After confirming the user is logged in, render the full page content
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Dataset Upload</h1>
      <p className={styles.subtitle}>
        Please upload your .h5ad file and provide the required information below.
      </p>

      <section className={styles.uploadSection}>
        <UploadForm />
      </section>

      <hr className={styles.separator} />

      <section className={styles.markdownSection}>
        <div className={styles.markdownContent}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}>
          {markdownContent}
        </ReactMarkdown>
        </div>
       
      </section>
    </div>
  );
}