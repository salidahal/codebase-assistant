from backend.chunker import chunk_repo
from backend.embedding import get_embeddings, embed_and_store

chunks = chunk_repo("target_repos/requests")

# Sort by file so related chunks group together, easier to scan
chunks_sorted = sorted(chunks, key=lambda c: (c["file"], c["start_line"]))
with open("chunks_summary.txt", "w") as f:
    for i, c in enumerate(chunks_sorted):
        f.write(f"[{i:3}] {c['type']:14} {c['name']:45} {c['file']} (L{c['start_line']}-{c['end_line']})\n")
print(f"Wrote {len(chunks)} chunks to chunks_summary.txt")

# --- Test embeddings ---
sample_vector = get_embeddings([chunks[0]["source"]])[0]
print(f"Vector length: {len(sample_vector)}")
print(f"First 10 numbers: {sample_vector[:10]}")

embed_and_store(chunks)




import chromadb

client = chromadb.PersistentClient(path="chroma_db")
collection = client.get_or_create_collection(name="requests_repo")

# 1. How many total records?
print(f"Total items in collection: {collection.count()}")

# 2. Peek at a few raw records (documents, metadata, and truncated embeddings)
peek = collection.peek(limit=3)
print("\n--- Peek at first 3 records ---")
for i in range(3):
    print(f"\nID: {peek['ids'][i]}")
    print(f"Metadata: {peek['metadatas'][i]}")
    print(f"Document (first 100 chars): {peek['documents'][i][:100]}")
    print(f"Embedding (first 5 numbers): {peek['embeddings'][i][:5]}")


from backend.embedding import retrieve, generate_answer

query = "how does requests handle redirects?"
chunks = retrieve(query)
answer = generate_answer(query, chunks)
print(answer)