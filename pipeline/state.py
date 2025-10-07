from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from core.llm.outputs import KeywordsExtractionResult, WorkletGenerationResult
from core.constants import *
from core.models.document import Documents
from core.models.worklet import Worklet

class AgentState(BaseModel):
    thread_id: str
    count: int
    files: Optional[List[Any]] = None
    links: List[str] = Field(default_factory=list)
    custom_prompt: Optional[str] = None
    parsed_data: Optional[Documents]
    links_data: Dict[str, Any] = Field(default_factory=dict)
    web_search: Optional[bool] = False
    web_search_results: Optional[Dict[str, str]] = Field(default_factory=dict)
    generation_output: Optional[WorkletGenerationResult]
    keywords_domains: Optional[KeywordsExtractionResult]
    worklets: List[Worklet] = Field(default_factory=list)