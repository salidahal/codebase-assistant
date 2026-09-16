import chromadb
from openai import OpenAI
import os
import json
from dotenv import load_dotenv

load_dotenv()

def _client(api_key: str | None = None) -> OpenAI:
    return OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))


def get_embeddings(texts: list[str], model="text-embedding-3-small", api_key: str | None = None) -> list[list[float]]:
    """Call OpenAI directly and return the raw embedding vectors."""
    response = _client(api_key).embeddings.create(input=texts, model=model)

    # response.data is a list of objects, one per input text, in the same order.
    # Each has an .embedding attribute - that's the actual vector.
    return [item.embedding for item in response.data]


def embed_and_store(chunks, collection_name="requests_repo", persist_directory="chroma_db", api_key=None):
    """Embed every chunk ourselves, then hand the finished vectors to Chroma."""
    chroma_client = chromadb.PersistentClient(path=persist_directory)
    collection = chroma_client.get_or_create_collection(name=collection_name)

    # Skip re-embedding if this collection already has data
    existing_count = collection.count()
    if existing_count > 0:
        print(f"Collection already has {existing_count} chunks — skipping embedding.")
        return collection

    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]

        texts = [c["source"] for c in batch]
        ids = [f"{c['file']}:{c['start_line']}" for c in batch]
        metadatas = [{
            "file": c["file"],
            "name": c["name"],
            "type": c["type"],
            "class_name": c["class_name"] or "",
            "start_line": c["start_line"],
            "end_line": c["end_line"],
            "is_test": c["is_test"],
        } for c in batch]

        vectors = get_embeddings(texts, api_key=api_key)   # <- this is the actual API call

        collection.add(
            ids=ids,
            embeddings=vectors,   # <- pre-computed vectors, not raw text
            documents=texts,
            metadatas=metadatas,
        )
        print(f"Embedded {min(i + batch_size, len(chunks))}/{len(chunks)} chunks")

    return collection



def _rows_from_query(results):
    return list(zip(
        results["ids"][0],
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ))


def retrieve(query: str, top_k: int = 5, collection_name="requests_repo", persist_directory="chroma_db", api_key=None):
    """Given a plain-English question, return the top_k most relevant chunks.
    Prefers implementation chunks; test chunks only fill remaining slots."""
    chroma_client = chromadb.PersistentClient(path=persist_directory)
    collection = chroma_client.get_or_create_collection(name=collection_name)

    # Embed the question the same way we embedded the chunks - same model, same function
    query_vector = get_embeddings([query], api_key=api_key)[0]

    impl_results = collection.query(
        query_embeddings=[query_vector],
        n_results=top_k,
        where={"is_test": False},
    )
    rows = _rows_from_query(impl_results)

    if len(rows) < top_k:
        test_results = collection.query(
            query_embeddings=[query_vector],
            n_results=top_k,
            where={"is_test": True},
        )
        seen_ids = {row_id for row_id, *_ in rows}
        for row in _rows_from_query(test_results):
            if row[0] in seen_ids:
                continue
            rows.append(row)
            if len(rows) >= top_k:
                break

    return [{**meta, "source": doc, "distance": dist} for _, doc, meta, dist in rows]


def generate_answer(query, retrieved_chunks, api_key=None):
    """Build a prompt from retrieved chunks and ask the LLM to answer."""

    # Build one labeled block of context from all retrieved chunks
    context_blocks = []
    for chunk in retrieved_chunks:
        label = f"{chunk['file']} - {chunk['name']}"
        if chunk.get("class_name"):
            label += f" (in class {chunk['class_name']})"
        context_blocks.append(f"### {label}\n```python\n{chunk['source']}\n```")

    context_text = "\n\n".join(context_blocks)

    system_prompt = (
        "You are an assistant that answers questions about a specific codebase. "
        "Only use the code provided below to answer - do not rely on general "
        "assumptions about what similar libraries typically do. If the provided "
        "code doesn't fully answer the question, say so explicitly rather than "
        "guessing. When you reference something, mention which file/function it "
        "came from."
    )

    user_prompt = f"Relevant code:\n\n{context_text}\n\nQuestion: {query}"

    response = _client(api_key).chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    return response.choices[0].message.content

import json  # add this to your existing imports at the top


def read_file(file_path: str) -> str:
    """Read a file's full contents, restricted to the target repo for safety."""
    safe_root = os.path.abspath("target_repos")
    requested_path = os.path.abspath(file_path)

    if not requested_path.startswith(safe_root):
        return "Error: access denied - file is outside the allowed directory."

    if not os.path.exists(requested_path):
        return f"Error: file not found: {file_path}"

    with open(requested_path, "r", encoding="utf-8") as f:
        return f.read()


# Tool schema - describes read_file to the LLM, doesn't run any code itself
tools = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the full contents of a specific file in the codebase, when retrieved code snippets aren't enough context.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file, e.g. target_repos/requests/src/requests/sessions.py",
                    }
                },
                "required": ["file_path"],
            },
        },
    }
]


def generate_answer_with_tools(query, retrieved_chunks, api_key=None):
    """Same as generate_answer, but lets the model call read_file if it needs to."""

    context_blocks = []
    for chunk in retrieved_chunks:
        label = f"{chunk['file']} - {chunk['name']}"
        if chunk.get("class_name"):
            label += f" (in class {chunk['class_name']})"
        context_blocks.append(f"### {label}\n```python\n{chunk['source']}\n```")
    context_text = "\n\n".join(context_blocks)

    system_prompt = (
        "You are an assistant that answers questions about a specific codebase. "
        "Use the provided code snippets first. If you need to see a full file "
        "for more context, use the read_file tool. Cite which file/function "
        "your answer comes from."
    )
    user_prompt = f"Relevant code:\n\n{context_text}\n\nQuestion: {query}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    for _ in range(3):
        response = _client(api_key).chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=tools,
        )
        message = response.choices[0].message

        if message.tool_calls:
            messages.append(message)
            for tool_call in message.tool_calls:
                args = json.loads(tool_call.function.arguments)
                print(f"Tool called: read_file({args['file_path']})")  # so you can see it happen
                result = read_file(args["file_path"])
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })
        else:
            return message.content

    return "Reached tool-call limit without a final answer."