from backend.embedding import retrieve, generate_answer_with_tools

# expected_chunks: acceptable implementation chunk names for this question.
# expected_keywords: specific facts (status codes, exact terms), not generic
# topic words, since a topic word matches regardless of answer correctness.
test_cases = [
    {
        "question": "How does requests handle redirects?",
        "expected_chunks": ["rebuild_method", "get_redirect_target", "is_redirect", "is_permanent_redirect", "next"],
        "expected_keywords": ["301", "302"],
    },
    {
        "question": "How does requests handle authentication?",
        "expected_chunks": ["__call__", "handle_401", "rebuild_auth", "get_netrc_auth"],
        "expected_keywords": ["basic", "digest"],
    },
    {
        "question": "How does the Session class manage cookies?",
        "expected_chunks": ["set_cookie", "session", "__setstate__", "_copy_cookie_jar", "__getstate__"],
        "expected_keywords": ["jar", "session"],
    },
    {
        "question": "How does requests determine the encoding of a response?",
        "expected_chunks": ["text", "get_unicode_from_response", "stream_decode_response_unicode", "content"],
        "expected_keywords": ["charset", "utf-8"],
    },
    {
        "question": "What happens when a request times out?",
        "expected_chunks": ["send", "__init__", "resolve_redirects"],
        "expected_keywords": ["connect", "read"],
    },
]

# Not part of requests - printed for manual review, not scored.
honesty_case = {
    "question": "How does requests implement OAuth2 token refresh?",
}


def check_retrieval(retrieved_chunks, expected_names):
    retrieved_names = [c["name"] for c in retrieved_chunks]
    hits = [name for name in expected_names if name in retrieved_names]
    top_is_test = bool(retrieved_chunks) and retrieved_chunks[0].get("is_test", False)
    ok = len(hits) > 0 and not top_is_test
    return ok, hits, top_is_test


def check_answer(answer, expected_keywords):
    answer_lower = answer.lower()
    hits = [kw for kw in expected_keywords if kw.lower() in answer_lower]
    return len(hits) == len(expected_keywords), hits


def run_eval():
    retrieval_passes = 0
    answer_passes = 0

    for i, case in enumerate(test_cases):
        print(f"\n{'='*60}")
        print(f"[{i+1}] {case['question']}")

        chunks = retrieve(case["question"])
        print("Retrieved:", [(c["name"], c["is_test"]) for c in chunks])
        answer = generate_answer_with_tools(case["question"], chunks)

        retrieval_ok, retrieval_hits, top_is_test = check_retrieval(chunks, case["expected_chunks"])
        answer_ok, answer_hits = check_answer(answer, case["expected_keywords"])

        retrieval_passes += retrieval_ok
        answer_passes += answer_ok

        retrieval_note = " (top hit was a test function!)" if top_is_test else ""
        print(f"Retrieval: {'PASS' if retrieval_ok else 'FAIL'}{retrieval_note} (found: {retrieval_hits or 'none'})")
        print(f"Answer:    {'PASS' if answer_ok else 'FAIL'} (found keywords: {answer_hits or 'none'})")
        if not answer_ok:
            print(f"--- full answer ---\n{answer}\n---")

    total = len(test_cases)
    print(f"\n{'='*60}")
    print(f"Retrieval accuracy: {retrieval_passes}/{total} ({retrieval_passes/total*100:.0f}%)")
    print(f"Answer accuracy:    {answer_passes}/{total} ({answer_passes/total*100:.0f}%)")

    print(f"\n{'='*60}")
    print("Honesty check (not scored - read this one yourself):")
    print(f"[{honesty_case['question']}]")
    chunks = retrieve(honesty_case["question"])
    answer = generate_answer_with_tools(honesty_case["question"], chunks)
    print(answer)
    print("\n(no real answer exists in this repo - check above for hallucinated OAuth2 detail)")


if __name__ == "__main__":
    run_eval()
