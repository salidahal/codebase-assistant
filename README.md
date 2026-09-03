# Codebase assistant

RAG-based AI assistant that answers questions about a codebase, using AST-aware chunking, hybrid retrieval, and agentic tool-use.

## Setup

1. **Create and activate a virtual environment**
   ```
   python3 -m venv venv
   source venv/bin/activate        # Mac/Linux
   venv\Scripts\activate           # Windows
   ```

2. **Install dependencies**
   ```
   pip install -r requirements.txt
   ```

3. **Add your API key**
   Copy `.env.example` to `.env` and fill in your real key:
   ```
   cp .env.example .env
   ```

4. **Verify it works**
   ```
   uvicorn backend.main:app --reload
   ```
   Visit http://127.0.0.1:8000/health — you should see `{"status": "ok"}`.

5. **Push to GitHub**
   ```
   git init
   git add .
   git commit -m "Initial project setup"
   git remote add origin <your repo URL>
   git branch -M main
   git push -u origin main
   ```

## Project structure

```
codebase-assistant/
├── backend/
│   ├── main.py          # FastAPI app
│   └── __init__.py
├── frontend/             # React UI (added later)
├── requirements.txt
├── .env.example
└── .gitignore
```

## Build plan

See project overview doc for the full day-by-day plan, problem statement, and framework choices.
