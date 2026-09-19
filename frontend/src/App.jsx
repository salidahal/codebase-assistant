import { Fragment, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

const EXAMPLE_QUESTIONS = [
  "How does requests handle redirects?",
  "How does the Session class manage cookies?",
  "How is the response encoding determined?",
];

const API_URL = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";

// Messages beyond this are still shown, but no longer sent to the model.
// Must not exceed the backend's `history` cap in main.py.
const HISTORY_LIMIT = 40;

function App() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState(
    () => sessionStorage.getItem("openai_key") ?? "",
  );

  async function askQuestion(question) {
    if (!question.trim() || loading) return;

    const history = messages
      .slice(-HISTORY_LIMIT)
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setQuery("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OpenAI-Api-Key": apiKey,
        },
        body: JSON.stringify({ query: question, history }),
      });

      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        setError(problem?.detail ?? `Server responded with ${response.status}`);
        return;
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
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

      {messages.map((m, i) => (
        <Fragment key={i}>
          {i > 0 && messages.length - i === HISTORY_LIMIT && (
            <p className="memory-divider">
              the assistant no longer remembers anything above this line
            </p>
          )}
          {m.role === "user" ? (
            <p className="turn-question">{m.content}</p>
          ) : (
            <section className="answer">
              <div className="markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {m.content}
                </ReactMarkdown>
              </div>

              {m.sources?.length > 0 && (
                <div className="sources">
                  <h3>Sources</h3>
                  <ul>
                    {m.sources.map((s, j) => (
                      <li key={j}>
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
        </Fragment>
      ))}

      {loading && (
        <div className="skeleton" aria-hidden="true">
          <div className="skeleton-line" style={{ width: "92%" }} />
          <div className="skeleton-line" style={{ width: "78%" }} />
          <div className="skeleton-line" style={{ width: "85%" }} />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <form className="ask-form" onSubmit={handleAsk}>
        <input
          type="password"
          className="api-key"
          value={apiKey}
          onChange={handleKeyChange}
          placeholder="sk-…  your OpenAI API key"
        />
        {apiKey ? (
          <p className="api-key-note">
            Kept in this tab only, and cleared when you close it.
          </p>
        ) : (
          <p className="api-key-note">
            Sent with each question and used only to answer it — never stored on
            the server. Kept in this browser tab only, and cleared when you close
            the tab. Closing the tab does not revoke the key, so use a key with a{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              spending limit
            </a>
            .
          </p>
        )}
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={2000}
          placeholder={
            messages.length > 0
              ? "Ask a follow-up…"
              : "How does requests handle redirects?"
          }
          rows={3}
        />
        {messages.length > HISTORY_LIMIT && (
          <p className="memory-note">
            Only the last {HISTORY_LIMIT / 2} exchanges are remembered — older
            ones stay on screen but are no longer sent with your question.
          </p>
        )}
        <div className="ask-row">
          <button type="submit" disabled={loading}>
            {loading ? "Thinking…" : "Ask"}
          </button>
          {messages.length === 0 && (
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
          )}
        </div>
      </form>
    </div>
  );
}

export default App;
