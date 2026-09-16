from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from openai import AuthenticationError
from backend.embedding import retrieve, generate_answer_with_tools

REPO_ID = "psf/requests"
COMMIT_SHA = "dae7ef63b4df6eded86637f251fc4e3a06c3b479"


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
def ask(question: Question, x_openai_api_key: str | None = Header(default=None)):
    if not x_openai_api_key:
        raise HTTPException(
            status_code=400,
            detail="Add your OpenAI API key to ask a question.",
        )

    try:
        chunks = retrieve(question.query, api_key=x_openai_api_key)
        answer = generate_answer_with_tools(
            question.query, chunks, api_key=x_openai_api_key
        )
    except AuthenticationError:
        raise HTTPException(
            status_code=401,
            detail="That OpenAI API key was rejected.",
        )

    sources = []
    for c in chunks:
        path = c["file"].removeprefix("target_repos/requests/")
        sources.append({
            "name": c["name"],
            "path": path,
            "github_url": (
                f"https://github.com/{REPO_ID}/blob/{COMMIT_SHA}/{path}"
                f"#L{c['start_line']}-L{c['end_line']}"
            ),
        })

    return {"answer": answer, "sources": sources}


frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
