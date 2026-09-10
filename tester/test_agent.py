from backend.embedding import retrieve, generate_answer_with_tools

query = "What does the full Session class in sessions.py look like, including its imports?"
chunks = retrieve(query)
answer = generate_answer_with_tools(query, chunks)
print(answer)