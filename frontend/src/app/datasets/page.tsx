"use client";

import { useEffect, useState } from 'react';
import { useAuth, api,BACKEND_URL } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '@/styles/Datasets.module.css';
import { AxiosError } from 'axios';

// A. Update the Dataset interface
interface Dataset {
  id: number;
  filename: string;
  tissue_info: string;
  description: string;
  upload_time: string;
  is_public: boolean; // <-- Add this
  owner_id: number;
  is_atlas: boolean;
  file_path:string;
  dataset_name: string;
}

export default function DatasetsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    } else if (user) {
      api.get('/datasets')
        .then(response => setDatasets(response.data))
        .catch(error => {
            console.error("Failed to fetch datasets:", error);
            setError("Failed to load datasets, please try again later.");
        });
    }
  }, [user, isLoading, router]);

  const handleDelete = async (datasetId: number) => {
    // Important: Add confirmation step to prevent accidental deletion
    if (!window.confirm('Are you sure you want to delete this dataset? This action cannot be undone.')) {
      return;
    }
    try {
      await api.delete(`/datasets/${datasetId}`);
      // Remove the deleted dataset from UI
      setDatasets(currentDatasets => currentDatasets.filter(d => d.id !== datasetId));
    } catch (err: unknown) {
      console.error("Failed to delete:", err);
      if (err instanceof AxiosError) {
        alert(`Delete failed: ${err.response?.data?.detail || 'Please check your network connection'}`);
      } else {
        alert('An unknown error occurred');
      }
    }
  };


  if (isLoading) return <p>Loading...</p>;
  if (!user) return null;

  return (
    <div className={styles.container}>
      <h1>My Datasets</h1>
      {error && <p className={styles.error}>{error}</p>} {/* Show loading error */}
      <div className={styles.datasetList}>
        {datasets.length > 0 ? (
          datasets.map(d => (
            <div key={d.id} className={styles.datasetCard}>
              <div className={styles.cardHeader}>
                <h3>{d.dataset_name}</h3>
                {d.is_public && <span className={styles.publicBadge}>Public</span>}
              </div>
              <p><strong>Tissue:</strong> {d.tissue_info.charAt(0).toUpperCase() + d.tissue_info.slice(1)}</p>
              <p className={styles.description} style={{display: 'none'}}><strong>Description:</strong> {d.description}</p>
              <small>Uploaded at: {new Date(d.upload_time).toLocaleString()}</small>
              <div className={styles.buttonGroup}>
                <Link href={`/analysis/${d.id}`} className={styles.analyzeButton}>
                  Analyze
                </Link>
                <button 
                  onClick={() => handleDelete(d.id)} 
                  className={styles.deleteButton}
                >
                  Delete
                </button>
                <a href={BACKEND_URL+d.file_path} target="_blank" rel="noopener noreferrer" className={styles.downloadButton}>
                  Download H5AD File 
                </a>
              </div>
            </div>
          ))
        ) : (
          <p>You have not uploaded any datasets yet. <Link href="/">Upload now</Link></p>
        )}
      </div>
    </div>
  );
}