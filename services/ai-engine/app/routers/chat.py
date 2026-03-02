from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ..providers import LLMProvider, get_provider
from ..services import ConversationContext

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "gpt-4o"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    tenant_settings: Optional[Dict[str, Any]] = {}

class ChatResponse(BaseModel):
    message: Dict[str, Any]
    model: str
    usage: Optional[Dict[str, Any]]

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Basic chat endpoint without RAG"""
    try:
        # Get LLM provider based on model
        provider = get_provider(request.model)
        
        # Build conversation context
        context = ConversationContext(
            messages=[m.dict() for m in request.messages],
            settings=request.tenant_settings or {},
        )
        
        # Get last user message
        user_message = None
        for msg in reversed(request.messages):
            if msg.role == "user":
                user_message = msg.content
                break
        
        if not user_message:
            raise HTTPException(status_code=400, detail="No user message found")
        
        # Build prompt with context
        system_prompt = context.build_system_prompt()
        
        # Call LLM
        response = await provider.chat(
            messages=[
                {"role": "system", "content": system_prompt},
                *[
                    {"role": m.role, "content": m.content}
                    for m in request.messages[-10:]  # Last 10 messages
                ]
            ],
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        
        return ChatResponse(
            message={
                "role": "assistant",
                "content": response["content"],
            },
            model=request.model,
            usage=response.get("usage"),
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
