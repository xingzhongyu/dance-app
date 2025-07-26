// src/types/dataset.ts
export interface AtlasMetadata {
    data_url?: string;
    species?: string;
    dataset_name?: string;
    preview_image_url?: string;
  }
  
  export interface Dataset {
    id: number;
    filename: string;
    tissue_info: string;
    description: string;
    upload_time: string;
    umap_csv_path?: string;
    atlas_metadata?: AtlasMetadata;
  }
  
  export interface UmapPoint {
    x: number;
    y: number;
    datasetId: number;
    filename: string;
    tissue: string;
  }