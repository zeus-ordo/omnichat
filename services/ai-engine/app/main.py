from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from .routers import chat, rag, embeddings

app = FastAPI(
    title="OmniBot AI Engine",
    description="Multi-tenant AI Chatbot Engine with LLM routing and RAG",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(rag.router, prefix="/api/chat/rag", tags=["RAG Chat"])
app.include_router(embeddings.router, prefix="/api/embeddings", tags=["Embeddings"])

# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ai-engine"}

@app.get("/")
async def root():
    return {"message": "OmniBot AI Engine", "docs": "/docs"}
