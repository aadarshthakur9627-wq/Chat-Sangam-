"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const models = [
  {
    id: "groq",
    name: "Groq",
    icon: "⚡",
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: "✦",
  },
];

export default function Home() {
  const [model, setModel] = useState("groq");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage(e) {
    e?.preventDefault();

    const text = message.trim();

    if (!text || loading) return;

    const userMessage = {
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];

    setMessages([
      ...nextMessages,
      {
        role: "assistant",
        content: "",
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: nextMessages,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("AI response failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, {
          stream: true,
        });

        fullText += chunk;

        setMessages((oldMessages) => {
          const updated = [...oldMessages];

          updated[updated.length - 1] = {
            role: "assistant",
            content: fullText,
          };

          return updated;
        });
      }

      const finalChunk = decoder.decode();

      if (finalChunk) {
        fullText += finalChunk;

        setMessages((oldMessages) => {
          const updated = [...oldMessages];

          updated[updated.length - 1] = {
            role: "assistant",
            content: fullText,
          };

          return updated;
        });
      }
    } catch (error) {
      console.error("Chat error:", error);

      setMessages((oldMessages) => {
        const updated = [...oldMessages];

        updated[updated.length - 1] = {
          role: "assistant",
          content:
            "Sorry, kuch problem aa gayi. Please dobara try karo.",
        };

        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    if (loading) return;

    setMessages([]);
    setMessage("");
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">✦</div>

          <div>
            <h1>Chat Sangam</h1>
            <span>AI Assistant</span>
          </div>
        </div>

        <button
          className="new-chat"
          onClick={startNewChat}
          disabled={loading}
        >
          ＋ New Chat
        </button>

        <div className="sidebar-section">
          <p>RECENT CHATS</p>

          {messages.length > 0 ? (
            <div className="chat-item">
              {messages[0]?.content?.slice(0, 28)}
            </div>
          ) : (
            <div className="empty-history">
              No conversations yet
            </div>
          )}
        </div>

        <div className="sidebar-bottom">
          <div>⚙ Settings</div>
          <div>◉ Account</div>
        </div>
      </aside>

      <section className="chat-area">
        <header className="topbar">
          <button className="mobile-menu">
            ☰
          </button>

          <div className="mobile-title">
            <strong>Chat Sangam</strong>
            <span>AI Assistant</span>
          </div>

          <div className="model-selector">
            {models.map((item) => (
              <button
                key={item.id}
                className={
                  model === item.id
                    ? "active-model"
                    : ""
                }
                onClick={() => setModel(item.id)}
                disabled={loading}
              >
                {item.icon} {item.name}
              </button>
            ))}
          </div>
        </header>

        <div className="messages">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-logo">
                ✦
              </div>

              <h2>How can I help you?</h2>

              <p>
                Ask anything and get intelligent
                answers from multiple AI models.
              </p>

              <div className="suggestions">
                <button
                  onClick={() =>
                    setMessage(
                      "Explain artificial intelligence simply"
                    )
                  }
                >
                  Explain AI simply
                </button>

                <button
                  onClick={() =>
                    setMessage(
                      "Help me learn mathematics"
                    )
                  }
                >
                  Learn Mathematics
                </button>

                <button
                  onClick={() =>
                    setMessage(
                      "Write a professional email"
                    )
                  }
                >
                  Write an email
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div
                  className={`message-row ${msg.role}`}
                  key={index}
                >
                  <div className="avatar">
                    {msg.role === "user"
                      ? "A"
                      : "✦"}
                  </div>

                  <div className="message-content">
                    {msg.role === "assistant" ? (
                      <div className="markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ node, ...props }) => (
                              <a
                                {...props}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}

                    {loading &&
                      msg.role === "assistant" &&
                      index ===
                        messages.length - 1 && (
                        <span className="typing-cursor">
                          ▌
                        </span>
                      )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="composer-wrapper">
          <form
            className="composer"
            onSubmit={sendMessage}
          >
            <textarea
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
              placeholder={
                loading
                  ? "AI is writing..."
                  : `Message ${
                      model === "groq"
                        ? "Groq"
                        : "Gemini"
                    }...`
              }
              rows={1}
              disabled={loading}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
            />

            <button
              className="send-button"
              type="submit"
              disabled={
                !message.trim() || loading
              }
            >
              ↑
            </button>
          </form>

          <div className="composer-note">
            Chat Sangam can make mistakes. Check
            important information.
          </div>
        </div>
      </section>
    </main>
  );
}
