
import asyncio
import os
from typing import List, Optional, Dict

from pydantic import BaseModel, Field

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession

@mcp.resource("dataset://")
async def list_datasets() -> List[DatasetInfo]:
    """Lists all available datasets."""
    return list(DB["datasets"].values())


@mcp.resource("dataset://{dataset_id}")
async def get_dataset(dataset_id: int) -> DatasetInfo:
    """
    Retrieves detailed information for a specific dataset by its ID.
    """
    dataset = DB["datasets"].get(dataset_id)
    if not dataset:
        raise ValueError(f"Dataset with ID {dataset_id} not found.")
    return dataset


# --- MCP Tools ---
# Tools allow the LLM to perform actions. They are like POST endpoints.

@mcp.tool()
def register_dataset(
    h5ad_file_path: str,
    dataset_name: str,
    description: str,
    tissue_info: str,
    csv_file_path: Optional[str] = None,
) -> DatasetInfo:
    """
    Registers a new dataset from files accessible by the server.

    This tool simulates the original '/api/datasets/upload' endpoint. Instead of
    uploading, the agent provides paths to files the server can read.

    Args:
        h5ad_file_path: The absolute path to the .h5ad data file on the server's filesystem.
        dataset_name: A descriptive name for the dataset.
        description: A longer description of the dataset's origin and contents.
        tissue_info: The tissue type the data is from (e.g., 'pancreas', 'lung').
        csv_file_path: An optional path to a CSV file with additional metadata.

    Returns:
        Information about the newly registered dataset, including its new ID.
    """
    # Basic validation
    if not os.path.exists(h5ad_file_path):
        raise FileNotFoundError(f"H5AD file not found at path: {h5ad_file_path}")
    if csv_file_path and not os.path.exists(csv_file_path):
        raise FileNotFoundError(f"CSV file not found at path: {csv_file_path}")

    # Create and "store" the dataset record
    dataset_id = DB["next_dataset_id"]
    new_dataset = DatasetInfo(
        id=dataset_id,
        name=dataset_name,
        description=description,
        tissue_info=tissue_info,
        h5ad_file_path=h5ad_file_path,
        csv_file_path=csv_file_path,
    )
    DB["datasets"][dataset_id] = new_dataset
    DB["next_dataset_id"] += 1

    return new_dataset


@mcp.tool()
async def start_analysis(
    dataset_id: int,
    analysis_param: str,
    ctx: Context[ServerSession, None],
) -> AnalysisResult:
    """
    Starts a bioinformatics analysis on a specified dataset.

    This single tool replaces the separate '/api/analysis/start' and
    '/api/analysis/status' endpoints. It runs the analysis asynchronously
    and streams progress updates back to the client.

    Args:
        dataset_id: The ID of the dataset to analyze.
        analysis_param: A string specifying the analysis parameters or method to use.
        ctx: The MCP context object, automatically injected to handle progress reporting.

    Returns:
        An object containing URLs to the resulting images and data files.
    """
    dataset = DB["datasets"].get(dataset_id)
    if not dataset:
        raise ValueError(f"Dataset with ID {dataset_id} not found.")

    result = await _run_mock_analysis(dataset.h5ad_file_path, analysis_param, ctx)
    return result


@mcp.tool()
async def get_atlas_method(
    tissue_info: str,
    ctx: Context[ServerSession, None],
) -> Dict[str, str]:
    """
    Retrieves a pre-defined atlas analysis method for a given tissue type.

    This tool corresponds to the '/api/atlas/function-download' endpoint.

    Args:
        tissue_info: The name of the tissue (e.g., 'pancreas') to get the method for.
        ctx: The MCP context object for progress reporting.

    Returns:
        A dictionary containing the URL or path to the retrieved method.
    """
    result = await _get_mock_atlas_method(tissue_info, ctx)
    return result

