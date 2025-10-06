from dotenv import load_dotenv
from tavily import TavilyClient
import os
import asyncio
import time

load_dotenv()
tavily_api_key = os.getenv("TAVILY_API_KEY")

# Initialize Tavily client
client = TavilyClient(api_key=tavily_api_key)


async def extract_links(urls: list[str], depth: str = "advanced"):
    attempts = 0
    while attempts < 5:
        try:
            return await asyncio.to_thread(
                client.extract,
                urls=urls,
                extract_depth=depth,
            )
        except Exception as e:
            attempts += 1
            print(f"Tavily search attempt {attempts} failed: {e}")
            if attempts >= 5:
                return {}
            await asyncio.sleep(1)
