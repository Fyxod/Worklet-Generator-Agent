import asyncio
import re
from typing import Optional, List
from pydantic import PrivateAttr
from langchain_core.language_models import BaseLanguageModel
from langchain_core.outputs import LLMResult
from langchain_core.messages import HumanMessage  # LangChain 1.0 replacement for PromptValue
from langchain_ollama import ChatOllama


class MyServerLLM(BaseLanguageModel):
    """
    Custom wrapper for a locally running Ollama model.

    Updated for LangChain 1.0:
        - PromptValue removed → use HumanMessage or str
        - Added required methods: invoke(), generate_prompt(), agenerate_prompt()
    """

    model: str
    port: int
    _client: ChatOllama = PrivateAttr()

    def __init__(self, model: str, port: int = 11434, **kwargs):
        print(f"Initializing MyOllamaLLM with model={model} at port={port}")
        super().__init__(model=model, port=port, **kwargs)

        self.model = model
        self.port = port
        self._client = ChatOllama(
            model=self.model,
            base_url=f"http://localhost:{self.port}",
            timeout=1000,
        )

    

    @property
    def _llm_type(self) -> str:
        """Used by LangChain to identify the LLM type"""
        return "ollama_local_llm"

    def _call(self, prompt: str, stop: Optional[List[str]] = None) -> str:
        try:
            response = self._client.invoke(prompt, stop=stop)
            # Remove <think> tags from output
            cleaned_text = re.sub(
                r"<think>.*?</think>", "", response.content, flags=re.DOTALL
            )
            return cleaned_text
        except Exception as e:
            raise RuntimeError(f"Failed to call Ollama locally: {e}") from e

    # ─────────────────────────────────────────────────────────────
    # REQUIRED NEW METHODS for LangChain 1.0
    # ─────────────────────────────────────────────────────────────

    def invoke(self, input, **kwargs):
        """
        Main entry point for LangChain Runnable pipelines.

        Accepts either:
        - str input
        - HumanMessage object (LangChain 1.0)
        """
        if isinstance(input, HumanMessage):
            text = input.content
        else:
            text = str(input)
        return self._call(text)

    def generate_prompt(self, prompt: HumanMessage, **kwargs) -> LLMResult:
        """
        Synchronous handling of HumanMessage prompts.
        Converts HumanMessage → text → _call() → LLMResult
        """
        text = prompt.content
        output = self._call(text)
        return LLMResult(generations=[[{"text": output}]])

    async def agenerate_prompt(self, prompt: HumanMessage, **kwargs) -> LLMResult:
        """
        Async handling of HumanMessage prompts.
        Runs _call() in a background thread.
        """
        text = prompt.content
        output = await asyncio.to_thread(self._call, text)
        return LLMResult(generations=[[{"text": output}]])
