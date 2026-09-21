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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* Load saved history */
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

  /* Save history */
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

        fullText += decoder.decode(value, {
          stream: true,
        });

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

      fullText += decoder.decode();

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
    setMobileMenuOpen(false);
  }

  function openChat(id) {
    if (loading) return;

    setActiveChatId(id);
    setMessage("");
    setMobileMenuOpen(false);
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

      {/* Desktop Sidebar */}

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

      {/* Mobile Overlay */}

      {mobileMenuOpen && (
        <div
          onClick={() =>
            setMobileMenuOpen(false)
          }
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "rgba(0,0,0,0.65)",
          }}
        />
      )}

      {/* Mobile Drawer */}

      {mobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            width: "285px",
            maxWidth: "82vw",
            zIndex: 1000,
            background: "#100b16",
            borderRight: "1px solid #332638",
            padding: "22px 16px",
            boxShadow:
              "15px 0 45px rgba(0,0,0,0.5)",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "25px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div className="logo">
                ✦
              </div>

              <div>
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "17px",
                  }}
                >
                  Chat Sangam
                </div>

                <div
                  style={{
                    color: "#9d91a3",
                    fontSize: "12px",
                  }}
                >
                  AI Assistant
                </div>
              </div>
            </div>

            <button
              onClick={() =>
                setMobileMenuOpen(false)
              }
              style={{
                border: 0,
                background: "transparent",
                color: "#aaa",
                fontSize: "25px",
              }}
            >
              ×
            </button>
          </div>

          <button
            className="new-chat"
            onClick={startNewChat}
            disabled={loading}
            style={{
              marginBottom: "28px",
            }}
          >
            ＋ New Chat
          </button>

          <div className="sidebar-section">
            <p>RECENT CHATS</p>

            {chats.length > 0 ? (
              chats.slice(0, 10).map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => openChat(chat.id)}
                  disabled={loading}
                  style={{
                    width: "100%",
                    border: 0,
                    borderRadius: "9px",
                    padding: "12px",
                    marginBottom: "5px",
                    textAlign: "left",
                    color: "#d5cbd7",
                    background:
                      chat.id === activeChatId
                        ? "#2a1830"
                        : "#1a111d",
                  }}
                >
                  💬{" "}
                  {chat.title || "New Chat"}
                </button>
              ))
            ) : (
              <div className="empty-history">
                No conversations yet
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: "35px",
              display: "grid",
              gap: "18px",
              color: "#958a99",
              fontSize: "14px",
            }}
          >
            <div>⚙ Settings</div>
            <div>◉ Account</div>
          </div>
        </div>
      )}

      {/* Main Chat */}

      <section className="chat-area">

        <header className="topbar">

          <button
            className="mobile-menu"
            onClick={() =>
              setMobileMenuOpen(true)
            }
          >
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
                onClick={() =>
                  setModel(item.id)
                }
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

              <h2>
                How can I help you?
              </h2>

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
