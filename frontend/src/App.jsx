import { Fragment, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./markdown.css";

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
    <div className="mx-auto max-w-[680px] px-6 pt-16 pb-20">
      <header>
        <span className="mb-2.5 block text-xs font-semibold tracking-[0.08em] text-accent uppercase">
          Codebase Assistant
        </span>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight">
          Ask questions about{" "}
          <code className="font-mono text-accent">requests</code>
        </h1>
        <p className="mb-9 max-w-[52ch] text-[15px] leading-relaxed text-muted">
          Answers are grounded in the indexed source of the{" "}
          <code className="font-mono text-accent">requests</code> library, with
          citations to the exact file and function they came from.
        </p>
      </header>

      {messages.map((m, i) => (
        <Fragment key={i}>
          {i > 0 && messages.length - i === HISTORY_LIMIT && (
            <p className="mt-11 border-t border-dashed border-line pt-5 text-center text-xs tracking-wide text-faint">
              the assistant no longer remembers anything above this line
            </p>
          )}
          {m.role === "user" ? (
            <p className="mt-11 rounded-r-md border-l-2 border-accent bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-muted">
              {m.content}
            </p>
          ) : (
            <section className="mt-4">
              <div className="markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {m.content}
                </ReactMarkdown>
              </div>

              {m.sources?.length > 0 && (
                <div className="mt-8 border-t border-line-soft pt-6">
                  <h3 className="mb-3 text-xs font-semibold tracking-wide text-dim uppercase">
                    Sources
                  </h3>
                  <ul className="flex list-none flex-col gap-2">
                    {m.sources.map((s, j) => (
                      <li key={j} className="text-[13.5px] text-dim">
                        <a
                          className="group flex items-baseline gap-2.5 no-underline"
                          href={s.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <code className="shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[13px] text-text transition-colors group-hover:border-accent">
                            {s.name}
                          </code>
                          <span className="[overflow-wrap:anywhere] transition-colors group-hover:text-muted">
                            {s.path}
                          </span>
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
        <div
          className="mt-10 flex flex-col gap-2.5 border-t border-line pt-8"
          aria-hidden="true"
        >
          <div className="skeleton-line" style={{ width: "92%" }} />
          <div className="skeleton-line" style={{ width: "78%" }} />
          <div className="skeleton-line" style={{ width: "85%" }} />
        </div>
      )}

      {error && <p className="mt-5 text-sm text-danger">{error}</p>}

      <form
        className="sticky bottom-0 flex flex-col gap-3.5 border-t border-line bg-ink py-4 pb-5"
        onSubmit={handleAsk}
      >
        <input
          type="password"
          className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 font-mono text-[13px] text-text outline-none placeholder:font-sans placeholder:text-faint focus:outline-2 focus:outline-offset-1 focus:outline-accent"
          value={apiKey}
          onChange={handleKeyChange}
          placeholder="sk-…  your OpenAI API key"
        />
        {apiKey ? (
          <p className="-mt-1.5 max-w-[62ch] text-xs leading-normal text-dim">
            Kept in this tab only, and cleared when you close it.
          </p>
        ) : (
          <p className="-mt-1.5 max-w-[62ch] text-xs leading-normal text-dim">
            Sent with each question and used only to answer it — never stored on
            the server. Kept in this browser tab only, and cleared when you close
            the tab. Closing the tab does not revoke the key, so use a key with a{" "}
            <a
              className="text-accent no-underline hover:underline"
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
          className="resize-y rounded-md border border-line bg-surface px-3.5 py-3 text-[15px] text-text outline-none focus:outline-2 focus:outline-offset-1 focus:outline-accent"
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
          <p className="-mt-1.5 rounded-r border-l-2 border-accent bg-surface px-3 py-2 text-xs leading-normal text-muted">
            Only the last {HISTORY_LIMIT / 2} exchanges are remembered — older
            ones stay on screen but are no longer sent with your question.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3.5">
          <button
            type="submit"
            disabled={loading}
            className="self-start rounded-md bg-accent px-5 py-2.5 text-[15px] font-medium text-ink disabled:cursor-default disabled:opacity-60"
          >
            {loading ? "Thinking…" : "Ask"}
          </button>
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="rounded-full border border-line bg-transparent px-3 py-1.5 text-[12.5px] text-muted transition-colors not-disabled:hover:border-accent not-disabled:hover:text-text disabled:cursor-default disabled:opacity-50"
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
