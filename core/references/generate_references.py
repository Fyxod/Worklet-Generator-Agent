import asyncio
from concurrent.futures import ThreadPoolExecutor
from time import time

from core.models.worklet import Reference
from pipeline.tools.search import search_tavily as search_tool
from core.references.github import get_github_references
from core.references.google_scholar import get_google_scholar_references

async def generate_references(keyword: str) -> list[Reference]:

    with ThreadPoolExecutor() as executor:
        loop = asyncio.get_running_loop()
        github_future = loop.run_in_executor(None, get_github_references, keyword)
        scholar_future = loop.run_in_executor(None, get_google_scholar_references, keyword)

        githubReferences, googleScholarReferences = await asyncio.gather(github_future, scholar_future)
        webReferences = []

        if len(googleScholarReferences) == 0:
            tool_results = search_tool(query=keyword, max_results=10, depth="advanced", include_answer=False, include_favicon=False)
            for r in tool_results.get("results", []):
                webReferences.append(Reference(
                    title=r.get("title", ""),
                    link=r.get("url", ""),
                    description=r.get("content", ""),
                    tag="google"
                ))

    response = []
    response.extend(googleScholarReferences)
    response.extend(githubReferences)
    response.extend(webReferences)

    return response
