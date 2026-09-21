"use client";

import { useEffect, useState } from "react";

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

const STORAGE_KEY = "chat-sangam-history";

function createChat() {
  return {
    id: Date.now().toString(),
    title: "New Chat",
    messages: [],
  };
}

export default function Home() {
  const [model, setModel] = useState("groq");

  const [chats, setChats] = useState([]);

  const [activeChatId, setActiveChatId] = useState(null);

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);

  const [loaded, setLoaded] = useState(false);

  /* Load saved chats */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed) && parsed.length > 0) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
        } else {
          const newChat = createChat();

          setChats([newChat]);
          setActiveChatId(newChat.id);
        }
      } else {
        const newChat = createChat();

        setChats([newChat]);
        setActiveChatId(newChat.id);
      }
    } catch (error) {
      console.error("History load error:", error);

      const newChat = createChat();

      setChats([newChat]);
      setActiveChatId(newChat.id);
    }

    setLoaded(true);
  }, []);

  /* Save chats */
  useEffect(() => {
    if (!loaded) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );
    } catch (error) {
      console.error("History save error:", error);
    }
  }, [chats, loaded]);

  const activeChat =
    chats.find((chat) => chat.id === activeChatId) ||
    null;

  const messages = activeChat?.messages || [];

  async function sendMessage(e) {
    e?.preventDefault();

    const text = message.trim();

    if (!text || loading || !activeChat) return;

    const userMessage = {
      role: "user",
      content: text,
    };

    const nextMessages = [
      ...messages,
      userMessage,
    ];

    const newTitle =
      messages.length === 0
        ? text.slice(0, 32)
        : activeChat.title;

    setChats((oldChats) =>
      oldChats.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              title: newTitle,
              messages: [
                ...nextMessages,
                {
                  role: "assistant",
                  content: "",
                },
              ],
            }
          : chat
      )
    );

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
        const { value, done } =
          await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, {
          stream: true,
        });

        fullText += chunk;

        setChats((oldChats) =>
          oldChats.map((chat) =>
            chat.id === activeChatId
              ? {
                  ...chat,
                  messages: chat.messages.map(
                    (msg, index) =>
                      index ===
                      chat.messages.length - 1
                        ? {
                            role: "assistant",
                            content: fullText,
                          }
                        : msg
                  ),
                }
              : chat
          )
        );
      }

      const finalChunk = decoder.decode();

      if (finalChunk) {
        fullText += finalChunk;
      }

      setChats((oldChats) =>
        oldChats.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: chat.messages.map(
                  (msg, index) =>
                    index ===
                    chat.messages.length - 1
                      ? {
                          role: "assistant",
                          content: fullText,
                        }
                      : msg
                ),
              }
            : chat
        )
      );
    } catch (error) {
      console.error("Chat error:", error);

      setChats((oldChats) =>
        oldChats.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: chat.messages.map(
                  (msg, index) =>
                    index ===
                    chat.messages.length - 1
                      ? {
                          role: "assistant",
                          content:
                            "Sorry, kuch problem aa gayi. Please dobara try karo.",
                        }
                      : msg
                ),
              }
            : chat
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    if (loading) return;

    const newChat = createChat();

    setChats((oldChats) => [
      newChat,
      ...oldChats,
    ]);

    setActiveChatId(newChat.id);

    setMessage("");
  }

  function openChat(id) {
    if (loading) return;

    setActiveChatId(id);

    setMessage("");
  }

  if (!loaded) {
    return (
      <main className="app">
        <div
          style={{
            width: "100%",
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            color: "#aaa",
          }}
        >
          Loading Chat Sangam...
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      {/* Sidebar */}

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

          {chats.length > 0 ? (
            chats.slice(0, 10).map((chat) => (
              <button
                key={chat.id}
                className="chat-item"
                onClick={() => openChat(chat.id)}
                disabled={loading}
                style={{
                  width: "100%",
                  border: "0",
                  textAlign: "left",
                  marginBottom: "4px",
                  cursor: loading
                    ? "not-allowed"
                    : "pointer",
                  background:
                    chat.id === activeChatId
                      ? "#241627"
                      : "#1a111d",
                }}
              >
                {chat.title || "New Chat"}
              </button>
            ))
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

      {/* Main Chat */}

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

        {/* Messages */}

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
                    {msg.content}

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

        {/* Composer */}

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
