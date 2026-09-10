import { useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleAsk(e) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const response = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();
      setAnswer(data.answer);
      setSources(data.sources);
    } catch (err) {
      setError("Could not reach the assistant. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Codebase Assistant</h1>
        <p>
          Ask questions about the <code>requests</code> library's source code.
        </p>
      </header>

      <form className="ask-form" onSubmit={handleAsk}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="How does requests handle redirects?"
          rows={3}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {answer && (
        <section className="answer">
          <h2>Answer</h2>
          <p>{answer}</p>

          {sources.length > 0 && (
            <div className="sources">
              <h3>Sources</h3>
              <ul>
                {sources.map((s, i) => (
                  <li key={i}>
                    <code>{s.name}</code> — {s.file}
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
