"use client";

import { useEffect, useState } from 'react';
import styles from '@/styles/AtlasUMAP.module.css'; // 确保这个 CSS 文件存在
import Papa from 'papaparse';
import Plot from 'react-plotly.js';
import  { type Data, type Layout, type ScatterData } from 'plotly.js';
import { BACKEND_URL } from '@/context/AuthContext';

// 假设你在 src/types/dataset.ts 中定义了这些类型
// 如果没有，你可以直接在这里定义它们
interface AtlasMetadata {
  data_url?: string;
  species?: string;
  dataset_name?: string;
  number_of_cells?: number;
  postive_pattern_csv_url?: string;
  negative_pattern_csv_url?: string;
}
interface Dataset {
  id: number;
  filename: string;
  tissue_info: string;
  description: string;
  umap_csv_path?: string;
  atlas_metadata?: AtlasMetadata;
}
interface UmapPoint {
  x: number;
  y: number;
  datasetId: string;
  filename: string;
  tissue: string;
  number_of_cells?: number;
  postive_pattern_csv_url?: string;
  negative_pattern_csv_url?: string;
}

// CSV数据类型定义
interface PatternCsvRow {
  function: string;
  [key: string]: string | number | boolean | null;
}

interface UmapCsvRow {
  UMAP1: number;
  UMAP2: number;
  [key: string]: string | number | boolean | null;
}

// 存储功能列表的接口
interface PatternFunctions {
  positive: string[];
  negative: string[];
}

// 按数据集ID存储功能列表的映射
type DatasetPatternMap = Record<string, PatternFunctions>;

// 定义组件的 props 类型
interface AtlasFacetedPlotProps {
  datasets: Dataset[];
}

export default function AtlasFacetedPlot({ datasets }: AtlasFacetedPlotProps) {
  // --- 状态管理 ---
  const [plotData, setPlotData] = useState<Data[]>([]);
  const [plotLayout, setPlotLayout] = useState<Partial<Layout>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [patternFunctions, setPatternFunctions] = useState<DatasetPatternMap>({});

  // 加载和解析CSV文件中的功能列表
  const loadPatternFunctions = async (datasetId: string, positiveUrl?: string, negativeUrl?: string): Promise<PatternFunctions> => {
    const result: PatternFunctions = { positive: [], negative: [] };
    
    // 加载positive模式CSV
    if (positiveUrl) {
      try {
        const parsePromise = new Promise<string[]>((resolve) => {
          Papa.parse(BACKEND_URL+positiveUrl, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.errors.length) {
                console.warn(`解析positive模式CSV出错:`, results.errors);
                resolve([]);
                return;
              }
              // 提取function列
              const functions = (results.data as PatternCsvRow[])
                .map(row => row.function)
                .filter(Boolean);
              resolve(functions);
            },
            error: (err) => {
              console.warn(`无法下载positive模式CSV:`, err);
              resolve([]);
            }
          });
        });
        
        result.positive = await parsePromise;
      } catch (err) {
        console.error(`加载${datasetId}的positive模式出错:`, err);
      }
    }
    
    // 加载negative模式CSV
    if (negativeUrl) {
      try {
        const parsePromise = new Promise<string[]>((resolve) => {
          Papa.parse(BACKEND_URL+negativeUrl, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.errors.length) {
                console.warn(`解析negative模式CSV出错:`, results.errors);
                resolve([]);
                return;
              }
              // 提取function列
              const functions = (results.data as PatternCsvRow[])
                .map(row => row.function)
                .filter(Boolean);
              resolve(functions);
            },
            error: (err) => {
              console.warn(`无法下载negative模式CSV:`, err);
              resolve([]);
            }
          });
        });
        
        result.negative = await parsePromise;
      } catch (err) {
        console.error(`加载${datasetId}的negative模式出错:`, err);
      }
    }
    
    return result;
  };

  // --- 数据处理和绘图逻辑 ---
  useEffect(() => {
    // 如果没有数据集，则直接停止
    if (!datasets || datasets.length === 0) {
        setIsLoading(false);
        return;
    }

    // 定义一个异步函数来处理所有数据获取和处理
    const processAndPlotData = async () => {
      setIsLoading(true);
      setError(null);

      // 1. 并发下载和解析所有 CSV 文件
      const promises = datasets
        .filter(d => d.umap_csv_path) // 过滤掉没有 UMAP 路径的数据集
        .map(d => new Promise<UmapPoint[]>((resolve) => {
          const fullUrl = `${d.umap_csv_path!}`;
          Papa.parse(BACKEND_URL+fullUrl, {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true, // 忽略 CSV 文件中的空行，增加健壮性
            complete: (results) => {
              if (results.errors.length) {
                console.warn(`Could not parse CSV for ${d.filename}:`, results.errors);
                resolve([]); // 解析失败，返回空数组，不中断整个流程
                return;
              }
              // 将解析出的每一行数据转换为我们需要的 UmapPoint 格式
              const points: UmapPoint[] = (results.data as UmapCsvRow[]).map(row => (
                {
                x: row.UMAP1,
                y: row.UMAP2,
                datasetId: d.atlas_metadata?.dataset_name || d.filename, // 关键：将父数据集的 ID 注入到每个点
                filename: d.filename,
                tissue: d.tissue_info,
                number_of_cells: d.atlas_metadata?.number_of_cells,
                postive_pattern_csv_url: d.atlas_metadata?.postive_pattern_csv_url,
                negative_pattern_csv_url: d.atlas_metadata?.negative_pattern_csv_url
              })).filter(p => p.x != null && p.y != null); // 过滤掉无效数据点
              resolve(points);
            },
            error: (err) => {
              console.warn(`Could not download CSV for ${d.filename}:`, err);
              resolve([]); // 下载失败也返回空数组
            }
          });
        }));

      try {
        const allPointsNested = await Promise.all(promises);
        const allPoints = allPointsNested.flat(); // 将所有点从嵌套数组展平为一维数组

        if (allPoints.length === 0) {
          setError("No valid UMAP data could be loaded from any dataset.");
          setIsLoading(false);
          return;
        }

        // 加载每个数据集的功能列表
        const patternPromises = [...new Set(allPoints.map(p => p.datasetId))].map(async (datasetId) => {
          // 找到该数据集中的第一个点，获取URL
          const samplePoint = allPoints.find(p => p.datasetId === datasetId);
          if (!samplePoint) return [datasetId, { positive: [], negative: [] }];
          
          const patterns = await loadPatternFunctions(
            datasetId, 
            samplePoint.postive_pattern_csv_url,
            samplePoint.negative_pattern_csv_url
          );
          
          return [datasetId, patterns] as [string, PatternFunctions];
        });
        
        // 等待所有功能列表加载完成
        const patternResults = await Promise.all(patternPromises);
        const datasetPatterns: DatasetPatternMap = Object.fromEntries(patternResults);
        // setPatternFunctions(datasetPatterns);

        // 2. 按 'tissue' 对所有点进行分组
        const pointsByTissue = allPoints.reduce((acc, point) => {
          acc[point.tissue] = acc[point.tissue] || [];
          acc[point.tissue].push(point);
          return acc;
        }, {} as Record<string, UmapPoint[]>);

        // 3. 为所有唯一的 'datasetId' 创建一个统一的颜色映射
        const allDatasetIds = [...new Set(allPoints.map(p => p.datasetId))].sort();
        const colorScale = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']; 

        const finalPlotData: Partial<ScatterData>[] = [];
        const layoutUpdates: Record<string, Partial<Layout>> = {};
        const tissues = Object.keys(pointsByTissue).sort(); // 对组织名称排序，保证每次渲染顺序一致

        // 4. 遍历每个 'tissue' 分组，为它们创建子图
        tissues.forEach((tissue, i) => {
          const tissuePoints = pointsByTissue[tissue];
          
          // 在每个 tissue 内部，再按 'datasetId' 分组，以便为不同数据集上色
          const pointsByDatasetId = tissuePoints.reduce((acc, point) => {
              acc[point.datasetId] = acc[point.datasetId] || [];
              acc[point.datasetId].push(point);
              return acc;
          }, {} as Record<string, UmapPoint[]>);

          // 5. 为每个数据集创建一个 'trace' (一个数据系列)
          Object.entries(pointsByDatasetId).forEach(([datasetIdStr, datasetPoints]) => {
              const datasetId = datasetIdStr;
              const colorIndex = allDatasetIds.indexOf(datasetId);

              finalPlotData.push({
                x: datasetPoints.map(p => p.x),
                y: datasetPoints.map(p => p.y),
                name: `ID: ${datasetId}`, // 图例中显示的名称
                text: datasetPoints.map(p => {
                   const patterns = datasetPatterns[p.datasetId] || { positive: [], negative: [] };
                   return `File: ${p.filename}<br>Tissue: ${p.tissue}<br><b>Positive:</b><br>${patterns.positive.map(f => `- ${f}`).join('<br>')}<br><b>Negative:</b><br>${patterns.negative.map(f => `- ${f}`).join('<br>')}`;
                 }),
                hoverinfo: 'text', // 悬浮时显示 text 内容
                mode: 'markers',
                type: 'scattergl', // 使用 WebGL 渲染，对大数据点性能更好
                marker: {
                  size: 4,
                  color: colorScale[colorIndex % colorScale.length], // 使用颜色映射，%length 防止颜色超出范围
                  opacity: 0.8
                },
                xaxis: `x${i + 1}`, // 分配到第 i+1 个 x 轴
                yaxis: `y${i + 1}`, // 分配到第 i+1 个 y 轴
                legendgroup: `group-${datasetId}`, // 让所有子图中相同 ID 的 trace 共享一个图例项
                // showlegend: i === 0, // 只为第一个子图的 trace 显示图例，避免重复
              });
          });

          // 6. 为当前子图的坐标轴添加标题
          layoutUpdates[`xaxis${i + 1}`] = { title: { text: 'UMAP 1' } };
          layoutUpdates[`yaxis${i + 1}`] = { title: { text: tissue } }; // 移除standoff属性
        });

        // 7. 定义整个图表的布局
        const finalLayout: Partial<Layout> = {
          title: { text: 'UMAP Overview of Atlas Datasets by Tissue' },
          // 关键：创建分面网格布局
          grid: {
            rows: Math.ceil(tissues.length / 3), // 每行最多 3 个子图
            columns: Math.min(tissues.length, 3),
            pattern: 'independent', // 每个子图有独立的坐标轴
          },
          showlegend: true,
          legend: { title: { text: 'Dataset ID' } },
          margin: { t: 60, l: 60, r: 30, b: 50 }, // 调整边距以容纳标题和标签
          ...layoutUpdates, // 合并每个子图的坐标轴标题
        };
        
        // 8. 更新状态以触发重新渲染
        setPlotData(finalPlotData);
        setPlotLayout(finalLayout);

      } catch (err) {
        console.error("An error occurred while processing UMAP data:", err);
        setError("An error occurred while processing UMAP data.");
      } finally {
        setIsLoading(false);
      }
    };

    processAndPlotData();
  }, [datasets]); // 依赖项是 datasets，当它从父组件传来时触发

  // --- 渲染逻辑 ---
  if (isLoading) {
    return <div className={styles.loading}>Loading and processing all UMAP data, this may take a moment...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }
  
  // 如果 datasets 存在但处理后没有可绘图的数据
  if (plotData.length === 0) {
    return <div className={styles.noData}>No data available to display in the plot. Check if datasets have UMAP CSV paths.</div>;
  }

  return (
    <div className={styles.container}>
      <h2>Atlas UMAP Overview</h2>
      <p className={styles.plotDescription}>Each subplot represents a tissue, with points colored by their source Dataset ID. Hover over points for details.</p>
      <div className={styles.plotWrapper}>
        <Plot
          data={plotData}
          layout={plotLayout}
          useResizeHandler={true} // 自动响应容器大小变化
          style={{ width: '100%', height: '100%' }}
          config={{
            responsive: true,
            displaylogo: false, // 不显示 Plotly logo
            scrollZoom: true, // 允许滚轮缩放
          }}
        />
      </div>
    </div>
  );
}