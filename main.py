"""
CLI and API for RAG prototype using Typer and FastAPI.
"""
import typer
from typing import List, Optional
from src.utils.logging import get_logger
from src.utils.document_loader import DocumentLoader
from src.utils.chunking import chunk_text
from src.core.embeddings import EmbeddingLoader
from src.core.retriever import FaissRetriever
from src.core.agent import RAGAgent
import numpy as np
import os
from dotenv import load_dotenv
from pathlib import Path

# --- FastAPI imports ---
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = typer.Typer()
logger = get_logger(__name__)

SUPPORTED_EXTS = {'.pdf', '.md', '.markdown', '.txt'}

# --- FastAPI app ---
api = FastAPI()
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    question: str
    top_k: Optional[int] = 5
    model: Optional[str] = 'all-MiniLM-L6-v2'
    llm: Optional[str] = 'llama-3.3-70b-versatile'

class QueryResponse(BaseModel):
    answer: str

class IngestRequest(BaseModel):
    folder: str = "./docs"
    model: Optional[str] = 'all-MiniLM-L6-v2'

@api.post("/api/query", response_model=QueryResponse)
async def api_query(req: QueryRequest):
    load_dotenv()
    if not os.getenv("GROQ_API_KEY"):
        return {"answer": "GROQ_API_KEY not set in .env file."}
    try:
        data = np.load('corpus.npz', allow_pickle=True)
        embs, texts = data['embs'], data['texts'].tolist()
        embedder = EmbeddingLoader(req.model)
        retriever = FaissRetriever(embs.shape[1])
        retriever.add(embs, texts)
        q_emb = embedder.embed_texts([req.question])
        ctxs = [t for t, _ in retriever.search(q_emb, req.top_k)]
        agent = RAGAgent(req.llm)
        answer = agent.generate(req.question, ctxs)
        return {"answer": answer}
    except Exception as e:
        logger.error(f"API Query failed: {e}")
        return {"answer": f"Error: {e}"}

@api.post("/api/ingest")
async def api_ingest(req: IngestRequest):
    folder_path = Path(req.folder)
    if not folder_path.exists() or not folder_path.is_dir():
        return {"status": f"Folder {req.folder} does not exist or is not a directory."}
    files = [str(f) for f in folder_path.iterdir() if f.suffix.lower() in SUPPORTED_EXTS and f.is_file()]
    if not files:
        return {"status": f"No supported documents found in {req.folder}."}
    try:
        loader = DocumentLoader()
        embedder = EmbeddingLoader(req.model)
        texts = []
        for f in files:
            t = loader.load(f)
            cs = chunk_text(t)
            texts.extend(cs)
        embs = embedder.embed_texts(texts)
        np.savez('corpus.npz', embs=embs, texts=texts)
        logger.info(f"Ingested {len(texts)} chunks from {len(files)} files.")
        return {"status": f"Ingested {len(texts)} chunks from {len(files)} files."}
    except Exception as e:
        logger.error(f"API Ingest failed: {e}")
        return {"status": f"Error: {e}"}

# --- CLI commands (unchanged) ---
@app.command()
def ingest(folder: str = typer.Option("./docs", help="Folder containing documents to ingest."), model: str = 'all-MiniLM-L6-v2'):
    """Ingest all supported documents in the specified folder and build vector DB."""
    try:
        folder_path = Path(folder)
        if not folder_path.exists() or not folder_path.is_dir():
            logger.error(f"Folder {folder} does not exist or is not a directory.")
            raise typer.Exit(1)
        files = [str(f) for f in folder_path.iterdir() if f.suffix.lower() in SUPPORTED_EXTS and f.is_file()]
        if not files:
            logger.error(f"No supported documents found in {folder}.")
            raise typer.Exit(1)
        loader = DocumentLoader()
        embedder = EmbeddingLoader(model)
        texts = []
        for f in files:
            t = loader.load(f)
            cs = chunk_text(t)
            texts.extend(cs)
        embs = embedder.embed_texts(texts)
        np.savez('corpus.npz', embs=embs, texts=texts)
        logger.info(f"Ingested {len(texts)} chunks from {len(files)} files.")
    except Exception as e:
        logger.error(f"Ingest failed: {e}")
        raise typer.Exit(1)

@app.command()
def query(
    question: str,
    top_k: int = 5,
    model: str = 'all-MiniLM-L6-v2',
    llm: str = 'llama-3.3-70b-versatile',
):
    """Query the ingested corpus. Requires GROQ_API_KEY in .env file."""
    try:
        load_dotenv()
        if not os.getenv("GROQ_API_KEY"):
            logger.error("GROQ_API_KEY not set in .env file.")
            raise typer.Exit(1)
        data = np.load('corpus.npz', allow_pickle=True)
        embs, texts = data['embs'], data['texts'].tolist()
        embedder = EmbeddingLoader(model)
        retriever = FaissRetriever(embs.shape[1])
        retriever.add(embs, texts)
        q_emb = embedder.embed_texts([question])
        ctxs = [t for t, _ in retriever.search(q_emb, top_k)]
        agent = RAGAgent(llm)
        answer = agent.generate(question, ctxs)
        typer.echo(answer)
    except Exception as e:
        logger.error(f"Query failed: {e}")
        raise typer.Exit(1)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "api":
        uvicorn.run("src.main:api", host="0.0.0.0", port=8000, reload=True)
    else:
        app() 