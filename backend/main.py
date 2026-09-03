from fastapi import FastAPI

app = FastAPI(title="Codebase Assistant")


@app.get("/health")
def health():
    """Sanity check endpoint - confirms the server is running."""
    return {"status": "ok"}


# The /ask endpoint (chunking, retrieval, agent loop) gets built next.
