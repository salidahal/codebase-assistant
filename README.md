# Codebase Assistant

An assistant that answers questions about a codebase (currently indexed: the `requests` library) by chunking code along function and class boundaries, embedding those chunks, and giving the model a tool to read a full file when retrieved context isn't sufficient. Built without LangChain or LlamaIndex, so every part of the retrieval and generation pipeline is implemented and understood directly rather than delegated to a framework.

## Motivation

Standard RAG treats code as prose: fixed-size chunks and similarity-only retrieval. This breaks down on code in a couple of specific ways. A character-count chunk can split a function in half or merge unrelated methods together. And for a question like "how does this library handle redirects," similarity search frequently ranks test functions above the implementation, since test names and docstrings are written in plain English (e.g. `test_HTTP_302_ALLOW_REDIRECT_GET`) and match the question's wording more closely than the source code does.

This project addresses both problems: chunks are defined by actual function/class boundaries via Python's `ast` module rather than character counts, each chunk is tagged as implementation or test code, and retrieval prefers implementation chunks, only falling back to tests when there isn't enough matching implementation code. The model also has a `read_file` tool it can invoke to pull full file context when a retrieved snippet is incomplete, instead of answering from partial information.

**Scope:** this is a focused demonstration of the retrieval and agentic-tool-use techniques behind tools like Cursor or Sourcegraph, built for a single indexed repository, not a general-purpose or production-grade code intelligence system.

## Architecture

- **Chunking:** Python's `ast` module parses each file and extracts functions and classes as individual chunks. Methods are tagged with their parent class name without storing the class itself as a separate, redundant chunk. Each chunk is also tagged `is_test` (by path and filename convention) so retrieval can tell implementation and test code apart.
- **Embeddings:** OpenAI `text-embedding-3-small`, called directly rather than through Chroma's embedding function, keeping the embedding step explicit rather than abstracted away.
- **Storage / retrieval:** ChromaDB (local, persistent), storing each chunk's vector, source code, and metadata (file, name, class, line numbers, is_test). Retrieval queries implementation chunks first and only pulls in test chunks to fill remaining slots if implementation coverage is thin.
- **Generation:** OpenAI `gpt-4o-mini`, with an agentic `read_file` tool the model can call when retrieved chunks don't fully answer the question. File access is sandboxed to the indexed repository.
- **Backend:** FastAPI, exposing a single `/ask` endpoint.
- **Frontend:** React (Vite), a question/answer interface that displays source citations alongside each answer.

## Project structure

```
backend/
  chunker.py      # AST-based chunking of a Python repo into function/class chunks
  embedding.py    # embeddings, Chroma storage/retrieval, and the LLM + read_file tool loop
  main.py         # FastAPI app exposing the /ask endpoint
tester/
  chunk_tester.py # indexing script: chunks target_repos/requests, embeds it, stores it in Chroma
  eval.py         # checks retrieval and answer quality against a fixed set of questions
  test_agent.py   # script for inspecting the agentic read_file tool-call loop on a single query
frontend/         # React (Vite) UI
target_repos/     # indexed repo(s); gitignored, cloned separately (see Setup)
```

## Setup

**1. Clone the target repository.** `requests` is currently hardcoded as the default in `chunk_tester.py` and as the default collection name in `embedding.py`:

```bash
git clone https://github.com/psf/requests.git target_repos/requests
```

**2. Create a virtual environment and install dependencies:**

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**3. Set an OpenAI API key:**

```bash
echo "OPENAI_API_KEY=sk-..." > .env
```

**4. Build the index.** This chunks the repository, generates embeddings, and populates the local Chroma store (`chroma_db/`); it also writes a readable `chunks_summary.txt` for inspecting the resulting chunks:

```bash
python -m tester.chunk_tester
```

**5. Run the backend:**

```bash
uvicorn backend.main:app --reload
```

**6. Run the frontend**, in a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at the URL Vite prints (typically `http://localhost:5173`) and communicates with the backend at `http://127.0.0.1:8000`.

## API

The backend exposes a single endpoint:

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "How does requests handle redirects?"}'
```

Response shape: `{"answer": "...", "sources": [{"file": ..., "name": ...}, ...]}`.

## Testing

- `python -m tester.eval`: runs a fixed set of questions and checks two things: that the top retrieved chunk is real implementation code rather than a test (the specific failure mode this project is meant to avoid), and that the generated answer contains specific, hard-to-fake keywords (status codes, exact terms) rather than just the topic word from the question. It also runs one deliberately unanswerable question (about OAuth2, which `requests` doesn't implement) and prints the raw answer for manual review, since checking honesty by keyword match isn't reliable. This is a sanity check used during development, not an automated or CI-enforced test suite, and the keyword checks are strict enough that a correct answer can occasionally fail just from phrasing differing between runs.
- `python -m tester.test_agent`: runs a single query through the agentic `read_file` tool-call loop for inspection.

## Limitations

- Chunking supports Python only, since it depends on the `ast` module; no chunker exists for other languages.
- Only functions and methods become chunks. A class with no methods (e.g. `requests`' exception hierarchy: `Timeout`, `TooManyRedirects`, etc. are plain subclasses with no bodies) produces no chunk at all and is invisible to retrieval.
- The target repository and Chroma collection name are hardcoded to `requests` / `requests_repo` rather than configurable per repository.
- `chunk_tester.py` skips re-embedding once a collection is non-empty, so switching or updating the target repository, or changing the chunking/metadata logic itself, requires manually clearing `chroma_db/` first and re-running it.
- No automated test suite; `tester/eval.py` is a manual check, not run in CI.
