from abc import ABC, abstractmethod
from typing import Dict, Any, List
import os
from openai import AsyncOpenAI
import anthropic

class LLMProvider(ABC):
    @abstractmethod
    async def chat(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        pass

class OpenAIProvider(LLMProvider):
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
    
    async def chat(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        try:
            response = await self.client.chat.completions.create(
                model=kwargs.get("model", "gpt-4o"),
                messages=messages,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens"),
            )
            
            return {
                "content": response.choices[0].message.content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                },
            }
        except Exception as e:
            return {
                "content": f"Error: {str(e)}",
                "usage": {"total_tokens": 0},
            }

class AnthropicProvider(LLMProvider):
    def __init__(self):
        anthropic.api_key = os.getenv("ANTHROPIC_API_KEY", "")
    
    async def chat(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        try:
            # Convert messages to Anthropic format
            system_message = messages[0]["content"] if messages[0]["role"] == "system" else ""
            anthropic_messages = [
                {"role": m["role"], "content": m["content"]}
                for m in messages
                if m["role"] != "system"
            ]
            
            response = await anthropic.AsyncAnthropic().messages.create(
                model=kwargs.get("model", "claude-3-5-sonnet-20241022"),
                system=system_message,
                messages=anthropic_messages,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 1024),
            )
            
            return {
                "content": response.content[0].text,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
                },
            }
        except Exception as e:
            return {
                "content": f"Error: {str(e)}",
                "usage": {"total_tokens": 0},
            }

class LocalProvider(LLMProvider):
    """For local models like Llama via Ollama"""
    
    async def chat(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        # Placeholder for local model integration
        return {
            "content": "Local model not configured",
            "usage": {"total_tokens": 0},
        }

def get_provider(model: str) -> LLMProvider:
    """Get the appropriate provider based on model name"""
    model_lower = model.lower()
    
    if model_lower.startswith("gpt") or model_lower.startswith("o1"):
        return OpenAIProvider()
    elif model_lower.startswith("claude"):
        return AnthropicProvider()
    else:
        # Default to OpenAI
        return OpenAIProvider()
