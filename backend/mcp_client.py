import asyncio
from fastmcp import Client, FastMCP

# In-memory server (ideal for testing)
server = FastMCP("TestServer")
client = Client(server)

# HTTP server
client = Client("http://sdu-112:81/mcp/mcp")

# # Local Python script
# client = Client("mcp_server.py")
h5ad_file_url="https://www.dropbox.com/scl/fi/26c6t2yk44kxqmc54djfz/human_Blood71be997d-ff75-41b9-8a9f-1288c865f921_data.h5ad?rlkey=kfv9p7kvx5vgdiav9ew9nj2me&st=18vy8dyy&dl=1"
async def main():
    async with client:
        # Basic server interaction
        await client.ping()
        
        # List available operations
        tools = await client.list_tools()
        resources = await client.list_resources()
        prompts = await client.list_prompts()
        
        # # # Execute operations
        # content =await client.read_resource("dataset://95")
        # print(content[0].text)
        
    #     result = await client.call_tool(
    #     "register_dataset",
    #     {"h5ad_file_url": h5ad_file_url, "tissue_info": "blood", "dataset_name": "human_Blood71be997d-ff75-41b9-8a9f-1288c865f921_data", "description": "value"},
    # )
    #     print(result)
    #wasserstein
    #     result = await client.call_tool(
    #     "start_analysis",
    #     {"dataset_id": 95, "analysis_param": "wasserstein"},
    # )
    #     print(result)
        result = await client.call_tool(
            "get_atlas_method",
            {"tissue_info": "blood", "atlas_dataset_id": "3faad104-2ab8-4434-816d-474d8d2641db"},
        )
        print(result)

asyncio.run(main())