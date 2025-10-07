import json
import time
import os
import aiofiles
import asyncio

from pipeline.graph_helpers import build_extraction_prompt, build_main_prompt, parallel_search
from pipeline.state import AgentState
from pipeline.tools.search import search_tavily as search_tool

from core.constants import *
from core.utils.generate_files import generate_file
from core.llm.client import invoke_llm
from core.models.worklet import Worklet
from core.llm.outputs import KeywordsExtractionResult, WorkletGenerationResult, ReferenceKeywordResult, ReferenceSortingResult
from core.references.generate_references import generate_references
from core.constants import QUERY_LLM
from core.services.upload_files import upload_files
from core.parsers.process_files import process_files
from core.models.document import Documents
from pipeline.tools.extract import extract_links
from core.llm.prompts.reference_sorting_prompt import reference_sorting_prompt
from core.llm.prompts.reference_keyword_prompt import reference_search_keyword_prompt as keyword_prompt

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
        prompt = keyword_prompt(worklet.title or worklet.problem_statement)
        try:
            result: ReferenceKeywordResult = await invoke_llm(gpu_model=state.model, contents=prompt, response_schema=ReferenceKeywordResult)
            keyword = result.keyword or worklet.title
        except Exception as e:
            print(f"Error extracting reference keyword for worklet '{worklet.title}': {e}")
            keyword = worklet.title
        references = await generate_references(keyword)
        state.worklets.append(Worklet(**worklet.model_dump(), references=references))

    print(f"Reference generation took {time.time() - s:.2f} seconds")
    return state

# remove this for the cpu version
async def sort_references(state: AgentState) -> AgentState:
    for worklet in state.worklets:
        if not worklet.references or len(worklet.references) == 0:
            continue

        references = {}
        for idx, ref in enumerate(worklet.references):
            references[idx] = ref.model_dump()
            prompt = reference_sorting_prompt(title=worklet.title, description=worklet.description, references=references)
            with open("debug/reference_sorting_prompt.txt", "w", encoding="utf-8") as f:
                f.write(prompt)

            result: ReferenceSortingResult = await invoke_llm(
                gpu_model=state.model,
                response_schema=ReferenceSortingResult,
                contents=prompt,
            )
            sorted_indices = result.sorted_indices
            sorted_references = [worklet.references[i] for i in sorted_indices if i < len(worklet.references)]
            worklet.references = sorted_references
            print(f"Sorted references for worklet '{worklet.title}': {sorted_indices}")
    return state

async def generate_files(state: AgentState) -> AgentState:

    if not state.worklets or len(state.worklets) == 0:
        return state

    s = time.time()
    for idx, worklet in enumerate(state.worklets):
        await generate_file(worklet=worklet, thread_id=state.thread_id)
    print(f"{idx + 1} File generation took {time.time() - s:.2f} seconds")
    return state