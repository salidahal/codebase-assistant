from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.embedding import retrieve, generate_answer

app = FastAPI(title="Codebase Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Question(BaseModel):
    query: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ask")
def ask(question: Question):
    chunks = retrieve(question.query)
    answer = generate_answer(question.query, chunks)
    return {
        "answer": answer,
        "sources": [{"file": c["file"], "name": c["name"]} for c in chunks],
    }