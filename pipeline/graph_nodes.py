import json
import time
import os
import aiofiles
import asyncio

from pipeline.graph_helpers import build_extraction_prompt, build_main_prompt, parallel_search
from pipeline.state import AgentState
from pipeline.tools.search import search_tavily as search_tool

from core.constants import *
from core.llm.client import invoke_llm
from core.models.worklet import Worklet
from core.llm.outputs import KeywordsExtractionResult, WorkletGenerationResult
from core.references.generate_references import generate_references
from core.constants import QUERY_LLM
from core.services.upload_files import upload_files
from core.parsers.process_files import process_files
from core.models.document import Documents
from pipeline.tools.extract import extract_links


async def process_input(state: AgentState) -> AgentState:
    s = time.time()
    if state.files:
        files_data = await upload_files(state.files, state.thread_id)
        if not files_data:
            print({"error": "No files uploaded or failed to upload files"})
        print(f"Raw file paths: {files_data}")
        parsed_data: Documents = await process_files(files_data, state.thread_id)
        if not parsed_data.documents:
            return {"error": "No documents could be processed successfully"}
        state.parsed_data = parsed_data

    if state.links:
        links_data = await extract_links(state.links)
        if not links_data:
            print({"error": "No links data extracted or failed to extract links data"})
        print(f"Extracted links data: {links_data}")
        state.links_data = links_data

    print(f"Input processing took {time.time() - s:.2f} seconds")
    return state


async def extract_keywords(state: AgentState) -> AgentState:
    s = time.time()
    prompt = build_extraction_prompt(state)
    with open("debug/extraction_prompt.txt", "w", encoding="utf-8") as f:
        f.write(prompt)

    result: KeywordsExtractionResult = await invoke_llm(
        gpu_model=state.model,
        response_schema=KeywordsExtractionResult,
        contents=prompt,
    )

    state.keywords_domains = result
    print(f"Keyword extraction took {time.time() - s:.2f} seconds")
    return state


async def generate_worklets(state: AgentState) -> AgentState:
    s = time.time()
    prompt = build_main_prompt(state)

    with open("debug/main_prompt.txt", "w", encoding="utf-8") as f:
        f.write(prompt)

    result: WorkletGenerationResult = await invoke_llm(
        gpu_model=state.model,
        response_schema=WorkletGenerationResult,
        contents=prompt,
    )
    state.worklet_data = result
    print(f"Worklet generation took {time.time() - s:.2f} seconds")
    return state

async def perform_web_search(state: AgentState) -> AgentState:
    if not state.generation_output.web_search or not state.generation_output.web_search_queries or len(state.generation_output.web_search_queries) == 0:
        return state

    s = time.time()
    queries = state.generation_output.web_search_queries
    if not queries:
        print("No web search queries provided, skipping web search.")
        return state

    print(f"Performing web search for queries: {queries}")
    web_search_results = await parallel_search(queries, search_tool)
    state.web_search_results = web_search_results
    print(f"Web search took {time.time() - s:.2f} seconds")
    return state

async def references(state: AgentState) -> AgentState:
    if not state.worklet_data or not state.worklet_data.worklets:
        return state

    s = time.time()
    for worklet in state.generation_output.worklets:
        references = await generate_references(worklet.problem_statement, worklet.title, state.model)
        state.worklets.append(Worklet(**worklet.model_dump(), references=references))

    print(f"Reference generation took {time.time() - s:.2f} seconds")
    return state

async def 