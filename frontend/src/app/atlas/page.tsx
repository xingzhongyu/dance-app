"use client";

import { useEffect, useState } from 'react';
import { api } from '@/context/AuthContext';
import dynamic from 'next/dynamic';
import AtlasDataTable from '@/components/AtlasDataTable';   // 导入表格组件
import styles from '@/styles/AtlasPage.module.css'; // 创建一个新的主布局样式文件
import type { Dataset } from '@/types/dataset';

// 动态导入 Plotly 组件，禁用 SSR
const AtlasFacetedPlot = dynamic(
  () => import('@/components/AtlasFacetedPlot'),
  { ssr: false }
);

export default function AtlasPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  useEffect(() => {
    // API 调用只在主页面进行一次
    api.get('/datasets/atlas')
      .then(response => { 
        console.log(response)
        setDatasets(response.data); 
      })
      .catch(error => { 
        console.error("Failed to load Atlas datasets:", error);
        setError("Failed to load Atlas datasets"); 
      })
      .finally(() => { 
        setIsLoading(false); 
      });
  }, []);

  if (isLoading) return <p className={styles.pageLoading}>Loading Atlas data...</p>;
  if (error) return <p className={styles.pageError}>{error}</p>;

  return (
    <div className={styles.container}>
      <h1>Atlas Datasets</h1>
      <p className={styles.pageDescription}>
        Explore the spatial distribution of all atlas datasets in the UMAP overview, or use the detailed table below to search and filter for specific data.
      </p>

      {/* 上半部分：分面图 */}
      <section className={styles.section}>
        <AtlasFacetedPlot datasets={datasets} />
      </section>

      <hr className={styles.separator} />

      {/* 下半部分：数据表格 */}
      <section className={styles.section}>
        <AtlasDataTable datasets={datasets} />
      </section>
    </div>
  );
}