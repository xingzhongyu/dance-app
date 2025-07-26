"use client";
import { useState, FormEvent, ChangeEvent } from 'react';
import { FileText, FileUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from '../styles/UploadForm.module.css';
import { api, useAuth } from '@/context/AuthContext'; // 引入api
import axios from 'axios';
const TISSUE_OPTIONS = ["blood", "brain", "heart", "intestine", "kidney", "lung", "pancreas"];

export default function UploadForm() {
  const { user } = useAuth();
  const [h5adFile, setH5adFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [datasetName, setDatasetName] = useState(''); // 添加数据集名称状态
  const [tissueInfo, setTissueInfo] = useState(TISSUE_OPTIONS[0]);
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false); // State for the admin checkbox
  const [status, setStatus] = useState({ message: '', type: '' });
  const router = useRouter();
  const handleH5adFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setH5adFile(e.target.files[0]);
  };

  const handleCsvFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setCsvFile(e.target.files[0]);
  };

  // const resetForm = () => {
  //   setH5adFile(null);
  //   setCsvFile(null);
  //   setDatasetName(''); // 重置数据集名称
  //   setTissueInfo(TISSUE_OPTIONS[0]);
  //   setDescription('');
  //   setIsPublic(false);
  //   // Reset file input fields visually
  //   (document.getElementById('h5ad-file') as HTMLInputElement).value = '';
  //   (document.getElementById('csv-file') as HTMLInputElement).value = '';
  // }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // A. Validate that both files are selected
    if (!h5adFile) {
      setStatus({ message: 'Please select a .h5ad file.', type: 'error' });
      return;
    }
    
    if (!datasetName.trim()) {
      setStatus({ message: 'Please enter a dataset name', type: 'error' });
      return;
    }

    setStatus({ message: 'Uploading...', type: 'loading' });

    const formData = new FormData();
    formData.append('h5ad_file', h5adFile);
    formData.append('dataset_name', datasetName); // 添加数据集名称
    if (csvFile) {
      formData.append('csv_file', csvFile);
    }
    formData.append('tissue_info', tissueInfo);
    formData.append('description', description);
    // C. Only append 'is_public' if the user is an admin
    if (user && user.is_admin) {
      formData.append('is_public', String(isPublic));
    }

    try {
      const response = await api.post('/datasets/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setStatus({ message: response.data.message || 'Upload successful!', type: 'success' });
      // Redirect to dataset list after success
      setTimeout(() => router.push('/datasets'), 1500);

    } catch (error: unknown) {
      console.error('Upload error:', error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.detail || 'An error occurred during upload.';
        setStatus({ message: errorMessage, type: 'error' });
      } else {
        setStatus({ message: 'An unknown error occurred during upload', type: 'error' });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* 添加数据集名称输入框 */}
      <div className={styles.formGroup}>
        <label htmlFor="dataset-name">Dataset Name</label>
        <input
          type="text"
          id="dataset-name"
          value={datasetName}
          onChange={(e) => setDatasetName(e.target.value)}
          placeholder="please input dataset name"
          required
        />
      </div>

      {/* D. Create two distinct file upload areas */}
      <div className={styles.fileInputGroup}>
        <div className={styles.fileDropArea}>
          <FileUp size={48} className={styles.fileIcon} />
          <input type="file" id="h5ad-file" accept=".h5ad" onChange={handleH5adFileChange} className={styles.fileInput} required />
          <label htmlFor="h5ad-file" className={styles.fileLabel}>
            {h5adFile ? `Selected: ${h5adFile.name}` : 'Click or drag H5AD file'}
          </label>
        </div>
        <div className={styles.fileDropArea} style={{display: 'none'}}>
          <FileText size={48} className={styles.fileIcon} />
          <span className={styles.optionalBadge}>Optional</span>
          <input type="file" id="csv-file" accept=".csv" onChange={handleCsvFileChange} className={styles.fileInput} />
          <label htmlFor="csv-file" className={styles.fileLabel}>
            {csvFile ? `Selected: ${csvFile.name}` : 'Click or drag CSV file'}
          </label>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>Tissue Information</label>
        <div className={styles.radioGroup}>
          {TISSUE_OPTIONS.map((option) => (
            <label key={option} className={styles.radioLabel}>
              <input
                type="radio"
                name="tissue-info" // 关键：所有单选按钮共享同一个 name
                value={option}
                checked={tissueInfo === option} // 关键：受控组件
                onChange={(e) => setTissueInfo(e.target.value)}
                required // 只需在第一个上添加即可
              />
              <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.formGroup} style={{display: 'none'}}>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Provide detailed information about the dataset..."
        />
      </div>


      {/* E. Conditionally render the "Set as Public" checkbox for admins */}
      {user && user.is_admin && (
        <div className={styles.adminCheckbox}>
          <input
            type="checkbox"
            id="is-public"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <label htmlFor="is-public">Set as public dataset (admin only)</label>
        </div>
      )}

      <button type="submit" className={styles.submitButton}>Start Upload</button>

      {status.message && (
        <p className={`${styles.statusMessage} ${styles[status.type]}`}>
          {status.message}
        </p>
      )}
    </form>
  );
}