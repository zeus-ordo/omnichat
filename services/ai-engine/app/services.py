from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from qdrant_client.http.models import Filter
import os
import uuid

class ConversationContext:
    def __init__(self, messages: List[Dict[str, Any]], settings: Dict[str, Any]):
        self.messages = messages
        self.settings = settings
    
    def build_system_prompt(self, rag_context: str = "") -> str:
        base_prompt = self.settings.get("system_prompt", "")
        
        if not base_prompt:
            base_prompt = """You are a helpful AI assistant for customer support. 
Provide accurate, friendly, and concise responses. 
Use the provided context to answer questions when available."""
        
        if rag_context:
            base_prompt += f"\n\nRelevant context:\n{rag_context}"
        
        return base_prompt

class RAGService:
    def __init__(self):
        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        qdrant_api_key = os.getenv("QDRANT_API_KEY", "")
        
        self.client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
    
    async def retrieve(
        self,
        query: str,
        tenant_id: str = "default",
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant documents for a query"""
        try:
            collection_name = f"tenant_{tenant_id}"
            
            # Check if collection exists
            try:
                self.client.get_collection(collection_name)
            except:
                return []
            
            # Search
            results = self.client.search(
                collection_name=collection_name,
                query_vector=query,  # Will be encoded by client
                limit=top_k,
            )
            
            return [
                {
                    "id": result.id,
                    "content": result.payload.get("content", ""),
                    "score": result.score,
                    "metadata": result.payload.get("metadata", {}),
                }
                for result in results
            ]
        except Exception as e:
            print(f"RAG retrieve error: {e}")
            return []
    
    def format_context(self, docs: List[Dict[str, Any]]) -> str:
        if not docs:
            return ""
        
        context_parts = []
        for i, doc in enumerate(docs, 1):
            content = doc.get("content", "")
            if content:
                context_parts.append(f"[{i}] {content}")
        
        return "\n\n".join(context_parts)

class EmbeddingService:
    def __init__(self):
        import openai
        openai.api_key = os.getenv("OPENAI_API_KEY", "")
    
    async def create_embeddings(self, texts: List[str], model: str = "text-embedding-3-small"):
        """Create embeddings for texts"""
        try:
            import openai
            
            response = await openai.Embedding.acreate(
                model=model,
                input=texts,
            )
            
            embeddings = [item["embedding"] for item in response["data"]]
            tokens = response["usage"]["total_tokens"]
            
            return {
                "embeddings": embeddings,
                "model": model,
                "tokens": tokens,
            }
        except Exception as e:
            raise Exception(f"Embedding creation failed: {str(e)}")
    
    async def embed_document(
        self,
        text: str,
        document_id: str,
        tenant_id: str = "default",
    ):
        """Embed and store a document"""
        # Split text into chunks
        chunks = self._split_into_chunks(text)
        
        # Create embeddings
        result = await self.create_embeddings(chunks)
        
        # Store in Qdrant
        collection_name = f"tenant_{tenant_id}"
        
        try:
            from qdrant_client import QdrantClient
            qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
            client = QdrantClient(url=qdrant_url)
            
            # Create collection if not exists
            try:
                client.get_collection(collection_name)
            except:
                client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
                )
            
            # Upsert points
            points = [
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload={
                        "content": chunk,
                        "document_id": document_id,
                    },
                )
                for chunk, embedding in zip(chunks, result["embeddings"])
            ]
            
            client.upsert(collection_name=collection_name, points=points)
            
            return {
                "chunks": len(chunks),
                "status": "embedded",
            }
        except Exception as e:
            raise Exception(f"Document embedding storage failed: {str(e)}")
    
    def _split_into_chunks(self, text: str, chunk_size: int = 1000) -> List[str]:
        """Split text into chunks"""
        words = text.split()
        chunks = []
        current_chunk = []
        current_size = 0
        
        for word in words:
            current_size += len(word) + 1
            if current_size > chunk_size:
                chunks.append(" ".join(current_chunk))
                current_chunk = [word]
                current_size = len(word)
            else:
                current_chunk.append(word)
        
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        
        return chunks
