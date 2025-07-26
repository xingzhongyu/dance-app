"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api,BACKEND_URL } from '@/context/AuthContext';
import Link from 'next/link';
import styles from '@/styles/AtlasDetail.module.css'; // We will create a new style file
import { ArrowLeft, ImageOff } from 'lucide-react';
import Papa from 'papaparse';
import Plot from 'react-plotly.js';
import { type Data } from 'plotly.js';

// Define the complete Atlas data interface
interface AtlasMetadata {
    dataset_name?: string;
    preview_image_url?: string;
    postive_pattern_image_url?: string;
    negative_pattern_image_url?: string;
    [key: string]: string | number | boolean | null | undefined; // 更具体的索引签名类型
}

// 需要展示的元数据字段列表
const VISIBLE_METADATA_FIELDS = [
  'species',
  'tissue',
  'data_fname',
  'data_url',
  'dataset_name',
  'dataset_id_col',
  'number_of_cells',
  'number_of_genes',
  'cell_type',
  'disease_origin',
  'cell_type_sampled',
  'disease_sampled',
  'assay',
  'assay_sampled',
  'cta_actinn',
  'cta_celltypist',
  'cta_scdeepsort',
  'cta_singlecellnet'
];

// UMAP 数据点接口
interface UmapDataPoint {
  UMAP1: number;
  UMAP2: number;
  cell_type: string;
  [key: string]: string | number | undefined;
}

// --- 独立的 UMAP 图组件 ---
const UmapPlotByCellType = ({ csvPath }: { csvPath: string }) => {
  const [plotData, setPlotData] = useState<Data[]>([]);
  const [plotLayout, setPlotLayout] = useState<Partial<Plotly.Layout>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!csvPath) return;
    const fullUrl = csvPath;

    Papa.parse(BACKEND_URL+fullUrl, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length) {
          setError("Failed to parse UMAP data.");
          return;
        }
        console.log(results.data);
        // 按 cell_type 分组
        const pointsByCellType = (results.data as UmapDataPoint[]).reduce((acc, row) => {
          const cellType = row.cell_type || 'Unknown';
          if (!acc[cellType]) {
            acc[cellType] = { x: [], y: [] };
          }
          acc[cellType].x.push(row.UMAP1);
          acc[cellType].y.push(row.UMAP2);
          return acc;
        }, {} as Record<string, { x: number[]; y: number[] }>);

        const data: Data[] = Object.entries(pointsByCellType as Record<string, { x: number[]; y: number[] }>).map(([cellType, points]) => ({
          x: points.x,
          y: points.y,
          name: cellType,
          mode: 'markers',
          type: 'scattergl',
          marker: { size: 4, opacity: 0.8 },
        }));

        setPlotData(data);
        setPlotLayout({
          title: { text: 'UMAP colored by Cell Type' },
          xaxis: { title: { text: 'UMAP 1' } },
          yaxis: { title: { text: 'UMAP 2' } },
          legend: { title: { text: 'Cell Types' } },
          margin: { l: 40, r: 20, b: 40, t: 40 },
          autosize: true,
        });
      },
      error: () => setError("Failed to download UMAP data."),
    });
  }, [csvPath]);

  if (error) return <div className={styles.plotError}>{error}</div>;
  if (plotData.length === 0) return <p>Loading UMAP plot...</p>;

  return (
    <Plot
      data={plotData}
      layout={plotLayout}
      useResizeHandler={true}
      style={{ width: '100%', height: '100%' }}
      config={{ responsive: true }}
    />
  );
};
interface DatasetDetail {
  id: number;
  filename: string;
  tissue_info: string;
  description: string;
  upload_time: string;
  umap_csv_path?: string;
  atlas_metadata?: AtlasMetadata;
}

export default function AtlasDetailPage() {
  const params = useParams();
  const atlasId = params.atlasId as string;

  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllMetadata, setShowAllMetadata] = useState(false);

  useEffect(() => {
    if (!atlasId) return;

    api.get(`/datasets/single_atlas/${atlasId}`)
      .then(response => {
        setDataset(response.data);
      })
      .catch(() => {
        setError("Failed to load dataset details, or the dataset does not exist.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [atlasId]);

  if (isLoading) return <p>Loading details...</p>;
  if (error) return <p className={styles.error}>{error}</p>;
  if (!dataset) return <p>Dataset not found.</p>;

  const { atlas_metadata, ...baseInfo } = dataset;

  return (
    <div className={styles.container}>
      <Link href="/atlas" className={styles.backLink}>
        <ArrowLeft size={18} /> Back to Atlas List
      </Link>
      
      <h1>{atlas_metadata?.dataset_name || baseInfo.filename}</h1>

      <div className={styles.grid}>
        {/* --- New: Image preview area --- */}
        {atlas_metadata?.preview_image_url && (
            <div className={`${styles.card} ${styles.previewCard}`} style={{display: 'none'}}>
                <h2>Preview Image</h2>
                <img
                    src={BACKEND_URL+atlas_metadata.preview_image_url} 
                    alt={`Preview of ${atlas_metadata?.dataset_name}`}
                    className={styles.previewImage}
                    width={500}
                    height={300}
                    // Graceful fallback when image fails to load
                    onError={(e) => { 
                      (e.currentTarget as HTMLImageElement).style.display = 'none'; 
                      if (e.currentTarget.nextElementSibling) {
                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                      }
                    }}
                />
                <div className={styles.fallbackContainer} style={{display: 'none'}}>
                    <ImageOff size={48} color="#888" />
                    <p>Preview image failed to load</p>
                </div>
            </div>
        )}
         {/* UMAP 可视化卡片 */}
         {dataset?.umap_csv_path && (
          <div className={`${styles.card} ${styles.plotCard} ${styles.fullWidth}`}>
            <h2>scVI UMAP</h2>
            <div className={styles.plotContainer}>
              <UmapPlotByCellType csvPath={dataset.umap_csv_path} />
            </div>
          </div>
        )}
        {/* Left: Basic Info */}
        <div className={styles.card}>
          <h2>Basic Information</h2>
          <ul>
            <li><strong>ID:</strong> {baseInfo.id}</li>
            <li><strong>Filename:</strong> {baseInfo.filename}</li>
            <li><strong>Tissue:</strong> {baseInfo.tissue_info}</li>
            <li><strong>Description:</strong> {baseInfo.description}</li>
            <li><strong>Upload Time:</strong> {new Date(baseInfo.upload_time).toLocaleString()}</li>
          </ul>
        </div>
        {atlas_metadata?.postive_pattern_image_url && (
          <div className={`${styles.card} ${styles.fullWidth}`}>
            <h2>Postive Pattern Image</h2>
            <img
              src={BACKEND_URL+atlas_metadata.postive_pattern_image_url} 
              alt="Postive Pattern"
            />
          </div>
        )}
        {atlas_metadata?.negative_pattern_image_url && (
          <div className={`${styles.card} ${styles.fullWidth}`}>
            <h2>Negative Pattern Image</h2>
            <img 
              src={BACKEND_URL+atlas_metadata.negative_pattern_image_url} 
              alt="Negative Pattern"
            />
          </div>
        )}
        {/* Right: Full Atlas Metadata */}
        {atlas_metadata && (
          <div className={`${styles.card} ${styles.fullWidth}`}>
            <h2>Atlas Metadata Details</h2>
            <div className={styles.metadataHeader} style={{display: 'none'}}>
              <button 
                onClick={() => setShowAllMetadata(!showAllMetadata)} 
                className={styles.toggleButton}
              >
                {showAllMetadata ? '显示重要字段' : '显示全部字段'}
              </button>
            </div>
            <div className={styles.metadataGrid}>
              {Object.entries(atlas_metadata)
                .filter(([key]) => {
                  // 总是过滤掉内部ID字段
                  if (key === 'id' || key === 'dataset_id') return false;
                  // 如果是显示全部，返回所有字段；否则只返回筛选字段
                  return showAllMetadata || VISIBLE_METADATA_FIELDS.includes(key);
                })
                .map(([key, value]) => {
                  // Show 'N/A' for null or undefined values
                  const displayValue = value === null || value === undefined ? 'N/A' : String(value);
                  return (
                    <div key={key} className={styles.metaItem}>
                      <strong className={styles.metaKey}>{key.replace(/_/g, ' ')}</strong>
                      <span className={styles.metaValue}>{displayValue}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}