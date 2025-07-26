"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/context/AuthContext';
import styles from '@/styles/Datasets.module.css'; // 确保这个 CSS 文件存在并包含所需样式
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { Loader2, Search } from 'lucide-react';

// 假设你在 src/types/dataset.ts 中定义了这些类型
// 如果没有，你可以直接在这里定义它们
interface AtlasMetadata {
  data_url?: string;
  species?: string;
  dataset_name?: string;
}
interface Dataset {
  id: number;
  filename: string;
  tissue_info: string;
  description: string;
  upload_time: string;
  atlas_metadata?: AtlasMetadata;
}

// 定义组件的 props 类型
interface AtlasDataTableProps {
  datasets: Dataset[];
}

// 将每页大小定义为常量，方便修改
const PAGE_SIZE = 10;

export default function AtlasDataTable({ datasets }: AtlasDataTableProps) {
  // --- 状态管理 ---

  // 筛选相关的状态
  const [globalFilter, setGlobalFilter] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('全部');
  const [tissueFilter, setTissueFilter] = useState('全部');

   // --- 新增状态：用于管理功能下载的 loading 状态 ---
  // 使用一个对象来跟踪每个数据集的下载状态
  const [functionDownloadState, setFunctionDownloadState] = useState<Record<number, 'idle' | 'loading' | 'error'>>({});

  // --- 新增：处理“Function Download”点击的函数 ---
  const handleFunctionDownload = async (datasetId: string,tissue_info:string) => {
    // 设置当前行的状态为 loading
    setFunctionDownloadState(prev => ({ ...prev, [datasetId]: 'loading' }));

    try {
      // 1. 启动任务
      const startResponse = await api.post(`/atlas/function-download`,{dataset_id:datasetId,tissue_info:tissue_info});
      const { task_id } = startResponse.data;

      if (!task_id) {
        throw new Error("Failed to start the download task.");
      }

      // 2. 轮询任务状态
      const poll = async (): Promise<string> => {
        const statusResponse = await api.get(`/atlas/function-download/status/${task_id}`);
        const { status, result, error } = statusResponse.data;

        if (status === 'SUCCESS') {
          return result; // 任务成功，返回结果 
        }
        if (status === 'FAILURE') {
          throw new Error(error || "Function generation failed.");
        }

        // 如果任务仍在进行中，等待 3 秒后再次查询
        await new Promise(resolve => setTimeout(resolve, 3000));
        return poll();
      };

      const result = await poll();
      // 3. 任务成功，触发下载
      if (result) {
        // 将 result 对象转为 JSON 字符串
        const jsonStr = JSON.stringify(result, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `function_${datasetId}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error("Task completed but no result data was provided.");
      }

      // 任务完成，重置状态
      setFunctionDownloadState(prev => ({ ...prev, [datasetId]: 'idle' }));

    } catch (error: unknown) {
      console.error("Function download failed:", error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      alert(`Error: ${errorMessage}`);
      // 任务失败，设置错误状态
      setFunctionDownloadState(prev => ({ ...prev, [datasetId]: 'error' }));
      // 短暂显示错误后恢复
      setTimeout(() => setFunctionDownloadState(prev => ({ ...prev, [datasetId]: 'idle' })), 3000);
    }
  };

  // 分页相关的状态
  const [currentPage, setCurrentPage] = useState(1);

  // --- 派生状态计算 (使用 useMemo 进行性能优化) ---

  // 1. 从原始数据中动态生成筛选选项，并去重、排序
  const speciesOptions = useMemo(() => {
    const speciesSet = new Set(datasets.map(d => d.atlas_metadata?.species).filter(Boolean));
    return ['全部', ...Array.from(speciesSet).sort()];
  }, [datasets]);

  const tissueOptions = useMemo(() => {
    const tissueSet = new Set(datasets.map(d => d.tissue_info).filter(Boolean));
    return ['全部', ...Array.from(tissueSet).sort()];
  }, [datasets]);

  // 2. 根据所有筛选条件，计算出过滤后的数据集
  const filteredData = useMemo(() => {
    return datasets.filter(d => {
      const term = globalFilter.toLowerCase();
      
      // 全局搜索逻辑
      const matchGlobal = !term ||
        (d.atlas_metadata?.dataset_name || d.filename).toLowerCase().includes(term) ||
        (d.atlas_metadata?.species || '').toLowerCase().includes(term) ||
        d.tissue_info.toLowerCase().includes(term) ||
        d.description.toLowerCase().includes(term);
        
      // 下拉筛选逻辑
      const matchSpecies = speciesFilter === '全部' || d.atlas_metadata?.species === speciesFilter;
      const matchTissue = tissueFilter === '全部' || d.tissue_info === tissueFilter;

      return matchGlobal && matchSpecies && matchTissue;
    });
  }, [datasets, globalFilter, speciesFilter, tissueFilter]);

  // 3. 计算分页信息和当前页需要显示的数据
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    // 确保 currentPage 在有效范围内
    const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
    const start = (validCurrentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredData.slice(start, end);
  }, [filteredData, currentPage, totalPages]);
  
  // 实时校正当前页码，防止因筛选导致页码超出范围
  useEffect(() => {
      if(currentPage > totalPages && totalPages > 0) {
          setCurrentPage(totalPages);
      }
  }, [currentPage, totalPages]);


  // --- TanStack Table 核心配置 ---

  // 4. 定义表格的列结构
  const columns = useMemo<ColumnDef<Dataset>[]>(() => [
    {
      accessorKey: 'atlas_metadata.dataset_name',
      header: 'Dataset Name',
      cell: info => info.row.original.atlas_metadata?.dataset_name || info.row.original.filename,
    },
    {
      accessorKey: 'atlas_metadata.species',
      header: 'Species',
      cell: info => info.getValue() || 'N/A',
    },
    {
      accessorKey: 'tissue_info',
      header: 'Tissue',
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: info => <div className={styles.descriptionCell} title={String(info.getValue())}>{String(info.getValue())}</div>,
    },
    {
      accessorKey: 'upload_time',
      header: 'Upload Time',
      cell: info => new Date(info.getValue<string>()).toLocaleString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const dataset = row.original;
        const isLoading = functionDownloadState[dataset.id] === 'loading';
        const isError = functionDownloadState[dataset.id] === 'error';

        return (
          <div className={styles.actionsCell}>
            <Link href={`/atlas/${dataset.id}`} className={styles.actionLink}>
              Details
            </Link>
            
            {/* 原下载按钮，重命名 */}
            {dataset.atlas_metadata?.data_url && (
              <a href={dataset.atlas_metadata.data_url} className={styles.actionLink}>
                Data Download
              </a>
            )}

            {/* 新的功能下载按钮 */}
            <button
              onClick={() => handleFunctionDownload(dataset.atlas_metadata?.dataset_name?.split('_')[0] || '',dataset.tissue_info)}
              className={`${styles.actionButton} ${isError ? styles.errorButton : ''}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className={styles.loadingIcon} />
                  Generating...
                </>
              ) : isError ? (
                'Error!'
              ) : (
                'Function Download'
              )}
            </button>
          </div>
        );
      },
    },
  ], [functionDownloadState]); // 依赖项加入 state，以便按钮状态能实时更新

  // 5. 创建 table 实例
  const table = useReactTable({
    data: paginatedData, // 关键：表格只接收当前页的数据进行渲染
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // --- 事件处理函数 ---
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(e.target.value);
    setCurrentPage(1); // 任何筛选或搜索操作都应该重置到第一页
  };

  // --- 渲染 JSX ---
  return (
    <div className={styles.dataTableSection}>
      <h2>Atlas Datasets Table</h2>
      
      {/* 筛选和搜索控件区域 */}
      <div className={styles.controlsContainer}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} size={20} />
          <input
            value={globalFilter}
            onChange={handleFilterChange(setGlobalFilter)}
            className={styles.searchInput}
            placeholder="Search datasets..."
          />
        </div>
        <div className={styles.filtersWrapper}>
          <select value={speciesFilter} onChange={handleFilterChange(setSpeciesFilter)} className={styles.filterSelect}>
            {speciesOptions.map(opt => <option key={opt} value={opt}>{opt === '全部' ? 'All Species' : opt}</option>)}
          </select>
          <select value={tissueFilter} onChange={handleFilterChange(setTissueFilter)} className={styles.filterSelect}>
            {tissueOptions.map(opt => <option key={opt} value={opt}>{opt === '全部' ? 'All Tissues' : opt}</option>)}
          </select>
        </div>
      </div>

      {/* 表格 */}
      <div className={styles.tableContainer}>
        <table className={styles.datasetTable}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} colSpan={header.colSpan}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} data-label={String(cell.column.columnDef.header)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className={styles.noResults}>
                  No matching datasets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页控件 */}
      {totalPages > 0 && (
        <div className={styles.pagination}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}