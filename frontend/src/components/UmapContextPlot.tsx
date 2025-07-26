"use client";

import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import Papa from 'papaparse';
import { type Data, type Layout } from 'plotly.js';
import { api,BACKEND_URL } from '@/context/AuthContext';
import styles from '@/styles/Analysis.module.css';
interface UmapPoint {
  x: number;
  y: number;
  sourceDatasetId: string;
}

interface UmapCsvRow {
  UMAP1: number;
  UMAP2: number;
  dataset_id?: string;
  [key: string]: string | number | boolean | null | undefined; // 允许其他字段
}

interface UmapContextPlotProps {
  tissue: string;
  highlightCsvUrl: string | null;
}


export default function UmapContextPlot({ tissue, highlightCsvUrl }: UmapContextPlotProps) {
  // --- 状态分解 ---
  const [backgroundPoints, setBackgroundPoints] = useState<UmapPoint[]>([]); // 只存储背景点
  const [highlightPoints, setHighlightPoints] = useState<UmapPoint[]>([]);   // 只存储高亮点
  const [highlightDatasetId, setHighlightDatasetId] = useState<string | null>(null);

  const [plotData, setPlotData] = useState<Data[]>([]);
  const [plotLayout, setPlotLayout] = useState<Partial<Layout>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Effect 1: 获取背景数据 (只在 tissue 改变时运行) ---
  useEffect(() => {
    if (!tissue) return;

    setIsLoading(true);
    setError(null);
    setBackgroundPoints([]); // 重置背景点

    const fetchBackgroundData = async () => {
      try {
        function capitalizeFirstLetter(val: string) {
            return val.charAt(0).toUpperCase() + val.slice(1);
        }
        const pathsResponse = await api.get(`/datasets/umaps_by_tissue/${capitalizeFirstLetter(tissue)}`);
        console.log(pathsResponse)
        const umapPaths: { id: number; umap_csv_path: string | null }[] = pathsResponse.data;

        const promises = umapPaths
          .filter(p => p.umap_csv_path)
          .map(p => new Promise<UmapPoint[]>((resolve) => {
            const fullUrl = `${p.umap_csv_path!}`;
            const file_name = fullUrl.split('/').pop() || '';
            Papa.parse(BACKEND_URL+fullUrl, {
              download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
              complete: (results) => {
                const points = (results.data as UmapCsvRow[]).map(row => ({
                  x: row.UMAP1, y: row.UMAP2, sourceDatasetId: file_name.split('.')[0],
                })).filter(pt => pt.x != null && pt.y != null);
                resolve(points);
              },
              error: () => resolve([]),
            });
          }));

        const allPointsNested = await Promise.all(promises);
        setBackgroundPoints(allPointsNested.flat());
      } catch (err) {
        console.log(err)
        setError("Failed to load background UMAP data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBackgroundData();
  }, [tissue]); // 依赖项只有 tissue

//   --- Effect 2: 获取高亮数据 (只在 highlightCsvUrl 改变时运行) ---
  useEffect(() => {
    if (!highlightCsvUrl) {
      setHighlightPoints([]); // 如果 URL 为空，清空高亮点
      setHighlightDatasetId(null);
      return;
    }

    const fetchHighlightData = () => {

        Papa.parse(highlightCsvUrl, {
            download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
            complete: (results) => {
                const highlight_dataset_id = tissue+"_" + (results.data as UmapCsvRow[])[0]['dataset_id']
               setHighlightDatasetId(highlight_dataset_id)
               const highlight_points = backgroundPoints.filter(p => p.sourceDatasetId === highlight_dataset_id)
               setHighlightPoints(highlight_points)
            },
            error: () => setError("Failed to load highlight data.")
        });
    }
    
    fetchHighlightData();
  }, [highlightCsvUrl, tissue, backgroundPoints]); // 这里缺少 tissue 和 backgroundPoints

  // --- Effect 3: 准备绘图数据 (当背景点或高亮点变化时运行) ---
  useEffect(() => {
    // 只有在背景数据加载完成后才进行绘图
    if (isLoading || backgroundPoints.length === 0) return;

    // 从背景点中排除掉当前高亮的数据集，避免重复绘制
    const filteredBackground = backgroundPoints.filter(p => p.sourceDatasetId !== highlightDatasetId);
    
    const data: Data[] = [
      {
        x: filteredBackground.map(p => p.x),
        y: filteredBackground.map(p => p.y),
        name: 'Other Datasets',
        mode: 'markers',
        type: 'scattergl',
        marker: { size: 4, color: '#d3d3d3', opacity: 0.5 },
      },
    ];

    if (highlightPoints.length > 0) {
      data.push({
        x: highlightPoints.map(p => p.x),
        y: highlightPoints.map(p => p.y),
        name: `Matched Dataset (ID: ${highlightDatasetId})`,
        mode: 'markers',
        type: 'scattergl',
        marker: { size: 5, color: '#ff5733', opacity: 0.9 },
      });
    }

    setPlotData(data);
    setPlotLayout({
      title: { text: `Atlas:${tissue.charAt(0).toUpperCase() + tissue.slice(1)}` },
      xaxis: { title: { text: 'UMAP 1' } },
      yaxis: { title: { text: 'UMAP 2' } },
      legend: { orientation: 'h', y: -0.2, yanchor: 'top' },
      margin: { l: 40, r: 20, b: 60, t: 40 },
      autosize: true,
    });

  }, [backgroundPoints, highlightPoints, highlightDatasetId, isLoading, tissue]); // 依赖所有影响绘图的数据

  // --- 渲染 ---
  if (isLoading) return <p>Loading UMAP Context Plot...</p>;
  if (error) return <div className={styles.plotError}>{error}</div>;

  return (
    <Plot
      data={plotData}
      layout={plotLayout}
      useResizeHandler
      style={{ width: '100%', height: '100%' }}
      config={{ responsive: true }}
    />
  );
}