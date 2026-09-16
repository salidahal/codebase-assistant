import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

const EXAMPLE_QUESTIONS = [
  "How does requests handle redirects?",
  "How does the Session class manage cookies?",
  "How is the response encoding determined?",
];

const API_URL = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";

function App() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState(
    () => sessionStorage.getItem("openai_key") ?? "",
  );

  async function askQuestion(question) {
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const response = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OpenAI-Api-Key": apiKey,
        },
        body: JSON.stringify({ query: question }),
      });

      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        setError(problem?.detail ?? `Server responded with ${response.status}`);
        return;
      }

      const data = await response.json();
      setAnswer(data.answer);
      setSources(data.sources);
    } catch {
      setError("Could not reach the assistant. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  function handleAsk(e) {
    e.preventDefault();
    askQuestion(query);
  }

  function handleKeyChange(e) {
    setApiKey(e.target.value);
    sessionStorage.setItem("openai_key", e.target.value);
  }

  function handleExampleClick(question) {
    setQuery(question);
    askQuestion(question);
  }

  return (
    <div className="page">
      <header className="header">
        <span className="eyebrow">Codebase Assistant</span>
        <h1>
          Ask questions about <code>requests</code>
        </h1>
        <p>
          Answers are grounded in the indexed source of the{" "}
          <code>requests</code> library, with citations to the exact file and
          function they came from.
        </p>
      </header>

      <form className="ask-form" onSubmit={handleAsk}>
        <input
          type="password"
          className="api-key"
          value={apiKey}
          onChange={handleKeyChange}
          placeholder="sk-…  your OpenAI key, kept in this browser tab only"
        />
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="How does requests handle redirects?"
          rows={3}
        />
        <div className="ask-row">
          <button type="submit" disabled={loading}>
            {loading ? "Thinking…" : "Ask"}
          </button>
          <div className="examples">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                className="example-chip"
                disabled={loading}
                onClick={() => handleExampleClick(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {loading && (
        <div className="skeleton" aria-hidden="true">
          <div className="skeleton-line" style={{ width: "92%" }} />
          <div className="skeleton-line" style={{ width: "78%" }} />
          <div className="skeleton-line" style={{ width: "85%" }} />
        </div>
      )}

      {!loading && answer && (
        <section className="answer">
          <h2>Answer</h2>
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>

          {sources.length > 0 && (
            <div className="sources">
              <h3>Sources</h3>
              <ul>
                {sources.map((s, i) => (
                  <li key={i}>
                    <a
                      className="source-link"
                      href={s.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <code className="source-name">{s.name}</code>
                      <span className="source-file">{s.path}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
