from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ..providers import LLMProvider, get_provider
from ..services import ConversationContext, RAGService

router = APIRouter()

class RAGRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: Optional[str] = "gpt-4o"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    tenant_settings: Optional[Dict[str, Any]] = {}
    use_rag: Optional[bool] = True
    top_k: Optional[int] = 5

class RAGResponse(BaseModel):
    message: Dict[str, Any]
    model: str
    usage: Optional[Dict[str, Any]]
    sources: Optional[List[Dict[str, Any]]] = []

@router.post("", response_model=RAGResponse)
async def chat_with_rag(request: RAGRequest):
    """Chat endpoint with RAG (Retrieval Augmented Generation)"""
    try:
        # Get LLM provider
        provider = get_provider(request.model)
        
        # Build conversation context
        context = ConversationContext(
            messages=request.messages,
            settings=request.tenant_settings or {},
        )
        
        # Get last user message
        user_message = None
        for msg in reversed(request.messages):
            if msg.get("role") == "user":
                user_message = msg.get("content")
                break
        
        if not user_message:
            raise HTTPException(status_code=400, detail="No user message found")
        
        # Retrieve relevant context from RAG
        sources = []
        context_text = ""
        
        if request.use_rag:
            rag_service = RAGService()
            try:
                retrieved_docs = await rag_service.retrieve(
                    query=user_message,
                    tenant_id=request.tenant_settings.get("tenant_id", "default"),
                    top_k=request.top_k or 5,
                )
                sources = retrieved_docs
                context_text = rag_service.format_context(retrieved_docs)
            except Exception as e:
                print(f"RAG retrieval error: {e}")
        
        # Build prompt with RAG context
        system_prompt = context.build_system_prompt(rag_context=context_text)
        
        # Call LLM
        response = await provider.chat(
            messages=[
                {"role": "system", "content": system_prompt},
                *[
                    {"role": m.get("role"), "content": m.get("content")}
                    for m in request.messages[-10:]
                ]
            ],
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        
        return RAGResponse(
            message={
                "role": "assistant",
                "content": response["content"],
            },
            model=request.model,
            usage=response.get("usage"),
            sources=sources,
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
