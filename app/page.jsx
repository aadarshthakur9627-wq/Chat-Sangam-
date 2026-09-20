"use client";

import { useState } from "react";

const models = [
  { id: "groq", name: "Groq", icon: "⚡" },
  { id: "gemini", name: "Gemini", icon: "✦" },
];

export default function Home() {
  const [model, setModel] = useState("groq");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage(e) {
    e.preventDefault();

    const text = message.trim();
    if (!text || loading) return;

    const userMessage = {
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI response failed");
      }

      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (error) {
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          content:
            "Sorry, kuch problem aa gayi. Please dobara try karo.",
        },
      ]);
    } finally {
      setLoading(false);
    }
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
          onClick={() => setMessages([])}
        >
          ＋ New Chat
        </button>

        <div className="sidebar-section">
          <p>RECENT CHATS</p>

          {messages.length > 0 ? (
            <div className="chat-item">
              {messages[0]?.content.slice(0, 28)}
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
          <button className="mobile-menu">☰</button>

          <div className="mobile-title">
            <strong>Chat Sangam</strong>
            <span>AI Assistant</span>
          </div>

          <div className="model-selector">
            {models.map((item) => (
              <button
                key={item.id}
                className={
                  model === item.id ? "active-model" : ""
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
              <div className="welcome-logo">✦</div>

              <h2>How can I help you?</h2>

              <p>
                Ask anything and get intelligent answers from
                multiple AI models.
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
                    setMessage("Help me learn mathematics")
                  }
                >
                  Learn Mathematics
                </button>

                <button
                  onClick={() =>
                    setMessage("Write a professional email")
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
                    {msg.role === "user" ? "A" : "✦"}
                  </div>

                  <div className="message-content">
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message-row assistant">
                  <div className="avatar">✦</div>

                  <div className="message-content">
                    Thinking...
                  </div>
                </div>
              )}
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
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                loading
                  ? "AI is thinking..."
                  : `Message ${
                      model === "groq" ? "Groq" : "Gemini"
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
              disabled={!message.trim() || loading}
            >
              ↑
            </button>
          </form>

          <div className="composer-note">
            Chat Sangam can make mistakes. Check important
            information.
          </div>
        </div>
      </section>
    </main>
  );
}
