from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from ..services import EmbeddingService

router = APIRouter()

class EmbeddingRequest(BaseModel):
    texts: List[str]
    model: str = "text-embedding-3-small"

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    model: str
    tokens: int

@router.post("", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    """Create embeddings for text"""
    try:
        service = EmbeddingService()
        result = await service.create_embeddings(
            texts=request.texts,
            model=request.model,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/document")
async def embed_document(text: str, document_id: str, tenant_id: str = "default"):
    """Embed a document for RAG"""
    try:
        service = EmbeddingService()
        result = await service.embed_document(
            text=text,
            document_id=document_id,
            tenant_id=tenant_id,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
