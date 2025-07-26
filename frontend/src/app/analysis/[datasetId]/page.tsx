"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth, api, BACKEND_URL } from '@/context/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import styles from '@/styles/Analysis.module.css'; // Create new style file
import UmapContextPlot from '@/components/UmapContextPlot';
import Papa from 'papaparse';
import PreprocessingSteps from '@/components/PreprocessingSteps'; 

// 1. Define analysis options constant
const ANALYSIS_OPTIONS = [
    "wasserstein", "Hausdorff", "chamfer", "energy", "sinkhorn2", 
    "bures", "spectral", "mmd"
];
interface MetadataRow {
  Method: string;
  "Preprocessing Step": string; // 属性名可以包含空格
  dataset_id: string;
}

interface AtlasMetadata {
  postive_pattern_image_url: string;
  negative_pattern_image_url: string;
  [key: string]: string | number | boolean | object; // 更具体的索引签名类型
}

export default function AnalysisPage() {
  const { user, isLoading } = useAuth();
  const params = useParams();
  const datasetId = params.datasetId as string;
  const router = useRouter();

  // --- State for the page ---
  const [datasetInfo, setDatasetInfo] = useState<{ tissue: string } | null>(null);
  const [datasetName, setDatasetName] = useState<string | null>(null);
  const [analysisParam, setAnalysisParam] = useState(ANALYSIS_OPTIONS[0]);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [csvUrl, setCsvUrl] = useState<string | null>(null); // This will drive the UMAP plot highlight
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [metadata, setMetadata] = useState<MetadataRow[]>([]);
  
  // 新增的atlas相关状态
  const [atlasMetadata, setAtlasMetadata] = useState<AtlasMetadata|null>(null);
  // const [loadingAtlasData, setLoadingAtlasData] = useState(false);
  // 修改函数：获取atlas元数据
  const fetchAtlasMetadata = useCallback(async (datasetIds: string[]) => {
    // setLoadingAtlasData(true);
    try {
      console.log(datasetIds);
      
      // 不再使用单独的API请求，而是使用新的API端点
      const atlasDataPromises = datasetIds.map(id => 
        api.get(`/datasets/atlas_metadata/${id+"_"+(datasetInfo?.tissue ? datasetInfo.tissue.charAt(0).toUpperCase() + datasetInfo.tissue.slice(1) : '')}`)
      );
      
      const results = await Promise.all(atlasDataPromises);
      const atlasData = results.map(response => response.data);
      setAtlasMetadata(atlasData[0].atlas_metadata);
    } catch (err) {
      console.error("Failed to fetch Atlas metadata:", err);
      setError(prev => prev + " Failed to fetch Atlas metadata.");
    } finally {
      // setLoadingAtlasData(false);
    }
  }, [datasetInfo]); // 只依赖 datasetInfo，因为用到了 datasetInfo?.tissue

  const parseAndSetMetadata = useCallback((url: string) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data) {
          console.log("Parsed CSV raw data:", results.data);
          
          const parsedMetadata = (results.data as MetadataRow[]).map((row) => ({
            Method: row.Method,
            "Preprocessing Step": row["Preprocessing Step"],
            dataset_id: row.dataset_id
          }));
          
          console.log("Processed metadata:", parsedMetadata);
          setMetadata(parsedMetadata);
          
          // 提取唯一的dataset_id并获取atlas元数据
          const atlasDatasetIds = Array.from(new Set(
            parsedMetadata
              .filter(row => {
                console.log("Checking row dataset_id:", row.dataset_id, typeof row.dataset_id);
                return row.dataset_id;
              })
              .map(row => row.dataset_id)
          ));
          
          console.log("Extracted atlas dataset IDs:", atlasDatasetIds);
          
          if (atlasDatasetIds.length > 0) {
            fetchAtlasMetadata(atlasDatasetIds);
          } else {
            console.log("No valid atlas dataset IDs, fetchAtlasMetadata not called");
          }
        }
      },
    });
  }, [fetchAtlasMetadata]);
  
  
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    api.get(`/datasets/${datasetId}`)
      .then(response => {
        setDatasetInfo({ tissue: response.data.tissue_info });
        setDatasetName(response.data.dataset_name);
      })
      .catch(() => {
        setError("Failed to load initial dataset information.");
      });
  }, [datasetId]);

  // Poll task status
  useEffect(() => {
    if (!taskId) return;

    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/analysis/status/${taskId}`);
        const { status, message, image_urls, csv_url } = response.data;
        setTaskStatus(status);
        setStatusMessage(message || '');
        if (status === 'SUCCESS') {
          setImageUrls(image_urls || []); // Handle null case
          setCsvUrl(csv_url);
          if (csv_url) {
            parseAndSetMetadata(csv_url);
          }
          setTaskId(null);
          clearInterval(interval);
        } else if (status === 'FAILURE') {
          setError(message || 'Analysis failed');
          setTaskId(null);
          clearInterval(interval);
        }
      } catch {
        setError('Failed to get task status');
        setTaskId(null);
        clearInterval(interval);
      }
    }, 3000); // Query every 3 seconds

    return () => clearInterval(interval);
  }, [taskId, parseAndSetMetadata]);


  const handleStartAnalysis = async () => {
    setError('');
    setTaskStatus('STARTING');
    setImageUrls([]);
    setMetadata([]);
    try {
      const formData = new FormData();
      formData.append('analysis_param', analysisParam);
      
      const response = await api.post(`/analysis/start/${datasetId}`, formData);
      const { task_id, status, image_urls, csv_url } = response.data;
      if (status === 'CACHED') {
          setTaskStatus('SUCCESS');
          setStatusMessage('Loaded result from dataset');
          setImageUrls(image_urls || []);
          setCsvUrl(csv_url);
          if (csv_url) {
            parseAndSetMetadata(csv_url);
          }
      } else {
          setTaskId(task_id);
          setTaskStatus('PENDING');
          setStatusMessage('Task submitted, waiting for execution...');
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'detail' in err.response.data) {
        setError((err.response as { data: { detail?: string } }).data.detail || 'Failed to start analysis');
      } else {
        setError('Failed to start analysis');
      }
      setTaskStatus(null);
    }
  };


  return (
    <div className={styles.container}>
      <h1>Analyze Dataset #{datasetName}</h1>
      
     
      
       {/* 3. Modify control area JSX */}
       <div className={styles.controls}>
        <label htmlFor="param">Analysis Parameter:</label>
        <select 
          id="param"
          value={analysisParam} 
          onChange={(e) => setAnalysisParam(e.target.value)} 
        >
          {ANALYSIS_OPTIONS.map(option => (
            <option key={option} value={option}>
              {/* For better display, capitalize the first letter */}
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
        <button onClick={handleStartAnalysis} disabled={!!taskId}>Start Analysis</button>
      </div>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.status}>
        <h3>Status: {taskStatus || 'Not started'}</h3>
        {statusMessage && <p>{statusMessage}</p>}
      </div>

      {datasetInfo?.tissue && (
        <div className={styles.results}>
          <h2>UMAP Context View</h2>
          <div className={styles.plotContainer}>
            <UmapContextPlot tissue={datasetInfo.tissue} highlightCsvUrl={csvUrl} />
          </div>
        </div>
      )}
      {/* 新增部分: 显示Atlas元数据 */}
      {atlasMetadata && (
        console.log(atlasMetadata),
        <div className={styles.results}>
        <h2>Preprocessing Pattern Landscape for the Query Dataset</h2>
        <div className={styles.imageGrid}>
          <img src={BACKEND_URL+atlasMetadata.postive_pattern_image_url} alt="Postive Pattern" />
          <img src={BACKEND_URL+atlasMetadata.negative_pattern_image_url} alt="Negative Pattern" />
        </div>
        </div>
      )}

      {metadata.length > 0 && (
        <div className={styles.results}>
          <h2>Preprocessing Pipeline Recommendation Conditioned on Analysis Method</h2>
          <div className={styles.tableContainer}>
            <table className={styles.metadataTable}>
              <thead>
                <tr>
                  {/* 手动定义表头，以保证顺序和名称 */}
                  <th>Method</th>
                  <th>Preprocessing Step</th>
                  <th>dataset_id</th>
                </tr>
              </thead>
              <tbody>
                {metadata.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td>{row.Method}</td>
                    <td>
                      <PreprocessingSteps stepsString={row["Preprocessing Step"]} />
                    </td>
                    <td>{row.dataset_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* E. Render CSV download link */}
      {csvUrl && (
        <div className={styles.results}>
          <div className={styles.fileDownload}>
            <a href={csvUrl} target="_blank" rel="noopener noreferrer" className={styles.downloadButton}>
              Download Optimal Preprocessing Options
            </a>
          </div>
        </div>
      )}
         
      
      {imageUrls.length > 0 && (
        <div className={styles.results}>
          <h2>Comparison of Similarity Metrics for Atlas Matching</h2>
          <div className={styles.imageGrid}>
          {imageUrls.map((url, index) => (
            console.log(url),
        // Key change: use url directly, no longer concatenate BACKEND_URL
        <img 
          key={index} 
          src={url}
          alt={`Analysis Result ${index + 1}`} 
        />
      ))}
          </div>
        </div>
      )}
      
    </div>
  );
}