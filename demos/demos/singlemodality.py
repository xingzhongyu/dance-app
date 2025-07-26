import collections
import os
import pprint
import shutil

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from demos.data.base import Data
from demos.m_typing import Dict,List,Set,Optional
from typing import Tuple
import os.path as osp

from demos.utils import cell_label_to_df
from demos import logger
import anndata as ad
import scanpy as sc
from demos.download import download_unzip,download_file
from demos.base import BaseDataset
from demos.registry import register_dataset
def _load_scdeepsort_metadata():
    path = "demos/scdeepsort.csv"
    logger.debug(f"Loading scdeepsort metadata from {path}")
    scdeepsort_meta_df = pd.read_csv(path).astype(str)

    bench_url_dict, available_data = {}, []
    for _, i in scdeepsort_meta_df.iterrows():
        bench_url_dict[i["celltype_fname"]] = i["celltype_url"]
        bench_url_dict[i["data_fname"]] = i["data_url"]
        available_data.append({key: i[key] for key in ("split", "species", "tissue", "dataset")})

    return bench_url_dict, available_data


@register_dataset("singlemodality")
class CellTypeAnnotationDataset(BaseDataset):
    _DISPLAY_ATTRS = ("species", "tissue", "train_dataset", "test_dataset")
    ALL_URL_DICT: Dict[str, str] = {
        "train_human_cell_atlas": "https://www.dropbox.com/s/1itq1pokplbqxhx?dl=1",
        "test_human_test_data": "https://www.dropbox.com/s/gpxjnnvwyblv3xb?dl=1",
        "train_mouse_cell_atlas": "https://www.dropbox.com/s/ng8d3eujfah9ppl?dl=1",
        "test_mouse_test_data": "https://www.dropbox.com/s/pkr28czk5g3al2p?dl=1",
    }  # yapf: disable
    BENCH_URL_DICT, AVAILABLE_DATA = _load_scdeepsort_metadata()

    def __init__(self, full_download=False, train_dataset=None, test_dataset=None, species=None, tissue=None,
                 valid_dataset=None, train_dir="train", test_dir="test", valid_dir="valid", map_path="map",
                 data_dir="./", train_as_valid=False, val_size=0.2, test_size=0.2, filetype: str = "csv"):
        super().__init__(data_dir, full_download)

        self.data_dir = data_dir
        self.train_dataset = train_dataset
        self.test_dataset = test_dataset
        self.species = species
        self.tissue = tissue
        self.train_dir = train_dir
        self.test_dir = test_dir
        self.valid_dir = valid_dir
        self.map_path = map_path
        self.train_as_valid = train_as_valid
        self.bench_url_dict = self.BENCH_URL_DICT.copy()
        self.available_data = self.AVAILABLE_DATA.copy()
        self.valid_dataset = valid_dataset
        if valid_dataset is None and self.train_as_valid:
            self.valid_dataset = train_dataset
            self.train2valid()
        self.val_size = val_size
        self.test_size = test_size
        self.filetype = filetype

    def train2valid(self):
        logger.info("Copy train_dataset and use it as valid_dataset")
        temp_ava_data = self.available_data.copy()
        temp_ben_url_dict = self.bench_url_dict.copy()
        for data in self.available_data:
            if data["split"] == "train":
                end_data = data.copy()
                end_data['split'] = 'valid'
                temp_ava_data.append(end_data)

        for k, v in self.bench_url_dict.items():
            if k.startswith("train"):
                temp_ben_url_dict[k.replace("train", "valid", 1)] = v
        self.available_data = temp_ava_data
        self.bench_url_dict = temp_ben_url_dict

    def download_all(self):
        if self.is_complete():
            return

        # Download and overwrite
        for name, url in self.ALL_URL_DICT.items():
            download_unzip(url, self.data_dir)

            parts = name.split("_")  # [train|test]_{species}_[cell|test]_atlas
            download_path = osp.join(self.data_dir, "_".join(parts[1:]))
            move_path = osp.join(self.data_dir, *parts[:2])

            os.makedirs(osp.dirname(move_path), exist_ok=True)
            try:
                shutil.rmtree(move_path)
            except FileNotFoundError:
                pass
            os.rename(download_path, move_path)

    def get_all_filenames(self, feat_suffix: str = "data", label_suffix: str = "celltype"):
        filenames = []
        for id in self.train_dataset + (self.test_dataset if self.test_dataset is not None else
                                        []) + (self.valid_dataset if self.valid_dataset is not None else []):
            filenames.append(f"{self.species}_{self.tissue}{id}_{feat_suffix}.{self.filetype}")
            filenames.append(f"{self.species}_{self.tissue}{id}_{label_suffix}.{self.filetype}")
        return filenames

    def download(self, download_map=True):
        if self.is_complete():
            return

        filenames = self.get_all_filenames()
        # Download training and testing data
        for name, url in self.bench_url_dict.items():
            parts = name.split("_")  # [train|test]_{species}_{tissue}{id}_[celltype|data].csv
            filename = "_".join(parts[1:])
            if filename in filenames:
                filepath = osp.join(self.data_dir, *parts[:2], filename)
                download_file(url, filepath)

        if download_map:
            # Download mapping data
            download_unzip("https://www.dropbox.com/sh/hw1189sgm0kfrts/AAAapYOblLApqygZ-lGo_70-a?dl=1",
                           osp.join(self.data_dir, "map"))

    def is_complete_all(self):
        """Check if data is complete."""
        check = [
            osp.join(self.data_dir, "train"),
            osp.join(self.data_dir, "test"),
            osp.join(self.data_dir, "pretrained")
        ]
        for i in check:
            if not osp.exists(i):
                logger.info(f"file {i} doesn't exist")
                return False
        return True

    def is_complete(self):
        """Check if benchmarking data is complete."""
        for name in self.bench_url_dict:
            if any(i not in name for i in (self.species, self.tissue)):
                continue
            filename = name[name.find(self.species):]
            file_i = osp.join(self.data_dir, *(name.split("_"))[:2], filename)
            if not osp.exists(file_i):
                logger.info(file_i)
                logger.info(f"file {filename} doesn't exist")
                return False
        # check maps
        map_check = [
            osp.join(self.data_dir, "map", "mouse", "map.xlsx"),
            osp.join(self.data_dir, "map", "human", "map.xlsx"),
            osp.join(self.data_dir, "map", "celltype2subtype.xlsx")
        ]
        for file in map_check:
            if not osp.exists(file):
                logger.info(f"file {name} doesn't exist")
                return False
        return True

    def _load_raw_data(self, ct_col: str = "Cell_type") -> Tuple[ad.AnnData, List[Set[str]], List[str], int]:
        species = self.species
        tissue = self.tissue
        valid_feat = None
        if self.test_dataset is None or self.test_dataset == []:
            return self._load_raw_data_single_h5ad()
        if self.valid_dataset is not None:
            train_dataset_ids = self.train_dataset
            test_dataset_ids = self.test_dataset
            valid_dataset_ids = self.valid_dataset
            data_dir = self.data_dir
            train_dir = osp.join(data_dir, self.train_dir)
            test_dir = osp.join(data_dir, self.test_dir)
            valid_dir = osp.join(data_dir, self.valid_dir)
            map_path = osp.join(data_dir, self.map_path, self.species)

            # Load raw data
            train_feat_paths, train_label_paths = self._get_data_paths(train_dir, species, tissue, train_dataset_ids)
            valid_feat_paths, valid_label_paths = self._get_data_paths(valid_dir, species, tissue, valid_dataset_ids)
            test_feat_paths, test_label_paths = self._get_data_paths(test_dir, species, tissue, test_dataset_ids)
            train_feat, valid_feat, test_feat = (self._load_dfs(paths, transpose=True)
                                                 for paths in (train_feat_paths, valid_feat_paths, test_feat_paths))
            train_label, valid_label, test_label = (self._load_dfs(paths)
                                                    for paths in (train_label_paths, valid_label_paths,
                                                                  test_label_paths))
        else:
            train_dataset_ids = self.train_dataset
            test_dataset_ids = self.test_dataset
            data_dir = self.data_dir
            train_dir = osp.join(data_dir, self.train_dir)
            test_dir = osp.join(data_dir, self.test_dir)
            map_path = osp.join(data_dir, self.map_path, self.species)
            train_feat_paths, train_label_paths = self._get_data_paths(train_dir, species, tissue, train_dataset_ids)
            test_feat_paths, test_label_paths = self._get_data_paths(test_dir, species, tissue, test_dataset_ids)
            train_feat, test_feat = (self._load_dfs(paths, transpose=True)
                                     for paths in (train_feat_paths, test_feat_paths))
            train_label, test_label = (self._load_dfs(paths) for paths in (train_label_paths, test_label_paths))
            if self.val_size > 0:
                train_feat, valid_feat, train_label, valid_label = train_test_split(train_feat, train_label,
                                                                                    test_size=self.val_size)
        if valid_feat is not None:
            # Combine features (only use features that are present in the training data)
            train_size = train_feat.shape[0]
            valid_size = valid_feat.shape[0]
            feat_df = pd.concat(
                train_feat.align(valid_feat, axis=1, join="left", fill_value=0) +
                train_feat.align(test_feat, axis=1, join="left", fill_value=0)[1:]).fillna(0)
            adata = ad.AnnData(feat_df, dtype=np.float32)

            # Convert cell type labels and map test cell type names to train
            cell_types = set(train_label[ct_col].unique())
            idx_to_label = sorted(cell_types)
            cell_type_mappings: Dict[str, Set[str]] = self.get_map_dict(map_path, tissue)
            train_labels, valid_labels, test_labels = train_label[ct_col].tolist(), [], []
            for i in valid_label[ct_col]:
                valid_labels.append(i if i in cell_types else cell_type_mappings.get(i))
            for i in test_label[ct_col]:
                test_labels.append(i if i in cell_types else cell_type_mappings.get(i))
            labels: List[Set[str]] = train_labels + valid_labels + test_labels

            logger.debug("Mapped valid cell-types:")
            for i, j, k in zip(valid_label.index, valid_label[ct_col], valid_labels):
                logger.debug(f"{i}:{j}\t-> {k}")

            logger.debug("Mapped test cell-types:")
            for i, j, k in zip(test_label.index, test_label[ct_col], test_labels):
                logger.debug(f"{i}:{j}\t-> {k}")

            logger.info(f"Loaded expression data: {adata}")
            logger.info(f"Number of training samples: {train_feat.shape[0]:,}")
            logger.info(f"Number of valid samples: {valid_feat.shape[0]:,}")
            logger.info(f"Number of testing samples: {test_feat.shape[0]:,}")
            logger.info(f"Cell-types (n={len(idx_to_label)}):\n{pprint.pformat(idx_to_label)}")

            return adata, labels, idx_to_label, train_size, valid_size
        else:
            # Combine features (only use features that are present in the training data)
            train_size = train_feat.shape[0]
            feat_df = pd.concat(train_feat.align(test_feat, axis=1, join="left", fill_value=0)).fillna(0)
            adata = ad.AnnData(feat_df, dtype=np.float32)

            # Convert cell type labels and map test cell type names to train
            cell_types = set(train_label[ct_col].unique())
            idx_to_label = sorted(cell_types)
            cell_type_mappings: Dict[str, Set[str]] = self.get_map_dict(map_path, tissue)
            train_labels, test_labels = train_label[ct_col].tolist(), []
            for i in test_label[ct_col]:
                test_labels.append(i if i in cell_types else cell_type_mappings.get(i))
            labels: List[Set[str]] = train_labels + test_labels

            logger.debug("Mapped test cell-types:")
            for i, j, k in zip(test_label.index, test_label[ct_col], test_labels):
                logger.debug(f"{i}:{j}\t-> {k}")

            logger.info(f"Loaded expression data: {adata}")
            logger.info(f"Number of training samples: {train_feat.shape[0]:,}")
            logger.info(f"Number of testing samples: {test_feat.shape[0]:,}")
            logger.info(f"Cell-types (n={len(idx_to_label)}):\n{pprint.pformat(idx_to_label)}")

            return adata, labels, idx_to_label, train_size, 0

    def _load_raw_data_single_h5ad(self,
                                   ct_col: str = "cell_type") -> Tuple[ad.AnnData, List[Set[str]], List[str], int]:
        species = self.species
        tissue = self.tissue
        valid_feat = None
        data_dir = self.data_dir
        train_dir = osp.join(data_dir, self.train_dir)
        data_path = osp.join(train_dir, species, f"{species}_{tissue}{self.train_dataset[0]}_data.h5ad")
        adata = sc.read_h5ad(data_path)
        map_path = osp.join(data_dir, self.map_path, self.species)
        X_train_temp, X_test = train_test_split(adata, test_size=0.2)
        X_train, X_val = train_test_split(X_train_temp, test_size=0.25)
        train_feat, valid_feat, test_feat = X_train.X, X_val.X, X_test.X
        train_label, valid_label, test_label = X_train.obs, X_val.obs, X_test.obs
        if valid_feat is not None:
            # Combine features (only use features that are present in the training data)
            train_size = train_feat.shape[0]
            valid_size = valid_feat.shape[0]
            # Convert cell type labels and map test cell type names to train
            cell_types = set(train_label[ct_col].unique())
            idx_to_label = sorted(cell_types)
            cell_type_mappings: Dict[str, Set[str]] = self.get_map_dict(map_path, tissue)
            train_labels, valid_labels, test_labels = train_label[ct_col].tolist(), [], []
            for i in valid_label[ct_col]:
                valid_labels.append(i if i in cell_types else cell_type_mappings.get(i))
            for i in test_label[ct_col]:
                test_labels.append(i if i in cell_types else cell_type_mappings.get(i))
            labels: List[Set[str]] = train_labels + valid_labels + test_labels

            logger.debug("Mapped valid cell-types:")
            for i, j, k in zip(valid_label.index, valid_label[ct_col], valid_labels):
                logger.debug(f"{i}:{j}\t-> {k}")

            logger.debug("Mapped test cell-types:")
            for i, j, k in zip(test_label.index, test_label[ct_col], test_labels):
                logger.debug(f"{i}:{j}\t-> {k}")

            logger.info(f"Loaded expression data: {adata}")
            logger.info(f"Number of training samples: {train_feat.shape[0]:,}")
            logger.info(f"Number of valid samples: {valid_feat.shape[0]:,}")
            logger.info(f"Number of testing samples: {test_feat.shape[0]:,}")
            logger.info(f"Cell-types (n={len(idx_to_label)}):\n{pprint.pformat(idx_to_label)}")

            return adata, labels, idx_to_label, train_size, valid_size
        else:
            # Combine features (only use features that are present in the training data)
            train_size = train_feat.shape[0]
            cell_types = set(train_label[ct_col].unique())
            idx_to_label = sorted(cell_types)
            cell_type_mappings: Dict[str, Set[str]] = self.get_map_dict(map_path, tissue)
            train_labels, test_labels = train_label[ct_col].tolist(), []
            for i in test_label[ct_col]:
                test_labels.append(i if i in cell_types else cell_type_mappings.get(i))
            labels: List[Set[str]] = train_labels + test_labels

            logger.debug("Mapped test cell-types:")
            for i, j, k in zip(test_label.index, test_label[ct_col], test_labels):
                logger.debug(f"{i}:{j}\t-> {k}")

            logger.info(f"Loaded expression data: {adata}")
            logger.info(f"Number of training samples: {train_feat.shape[0]:,}")
            logger.info(f"Number of testing samples: {test_feat.shape[0]:,}")
            logger.info(f"Cell-types (n={len(idx_to_label)}):\n{pprint.pformat(idx_to_label)}")

            return adata, labels, idx_to_label, train_size, 0

    def _raw_to_dance(self, raw_data):
        adata, cell_labels, idx_to_label, train_size, valid_size = raw_data
        adata.obsm["cell_type"] = cell_label_to_df(cell_labels, idx_to_label, index=adata.obs.index)
        data = Data(adata, train_size=train_size, val_size=valid_size)
        return data

    @staticmethod
    def _get_data_paths(data_dir: str, species: str, tissue: str, dataset_ids: List[str], *, filetype: str = "csv",
                        feat_suffix: str = "data", label_suffix: str = "celltype") -> Tuple[List[str], List[str]]:
        feat_paths, label_paths = [], []
        for path_list, suffix in zip((feat_paths, label_paths), (feat_suffix, label_suffix)):
            for i in dataset_ids:
                path_list.append(osp.join(data_dir, species, f"{species}_{tissue}{i}_{suffix}.{filetype}"))
        return feat_paths, label_paths

    @staticmethod
    def _load_dfs(paths: List[str], *, index_col: Optional[int] = 0, transpose: bool = False, **kwargs):
        dfs = []
        for path in paths:
            logger.info(f"Loading data from {path}")
            # TODO: load feat as csr
            df = pd.read_csv(path, index_col=index_col, **kwargs)
            # Labels: cell x cell-type; Data: feature x cell (need to transpose)
            df = df.T if transpose else df
            # Add dataset info to index
            dataset_name = "_".join(osp.basename(path).split("_")[:-1])
            df.index = dataset_name + "_" + df.index.astype(str)
            dfs.append(df)
        combined_df = pd.concat(dfs)
        return combined_df

    @staticmethod
    def get_map_dict(map_file_path: str, tissue: str) -> Dict[str, Set[str]]:
        """Load cell-type mappings.

        Parameters
        ----------
        map_file_path
            Path to the mapping file.
        tissue
            Tissue of interest.

        Notes
        -----
        Merge mapping across all test sets for the required tissue.

        """
        map_df = pd.read_excel(osp.join(map_file_path, "map.xlsx"))
        map_dict = collections.defaultdict(set)
        for _, row in map_df.iterrows():
            if row["Tissue"] == tissue:
                map_dict[row["Celltype"]].add(row["Training dataset cell type"])
        return dict(map_dict)
