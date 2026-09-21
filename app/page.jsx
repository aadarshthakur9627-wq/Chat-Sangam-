"use client";

import { useEffect, useState } from "react";
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

const STORAGE_KEY = "chat-sangam-chats";

function createChat() {
  return {
    id: Date.now().toString(),
    title: "New Chat",
    messages: [],
    updatedAt: Date.now(),
  };
}

export default function Home() {
  const [model, setModel] = useState("groq");
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const activeChat =
    chats.find((chat) => chat.id === activeChatId) || null;

  const messages = activeChat?.messages || [];

  // Load chats from browser storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed) && parsed.length > 0) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
        } else {
          const firstChat = createChat();
          setChats([firstChat]);
          setActiveChatId(firstChat.id);
        }
      } else {
        const firstChat = createChat();
        setChats([firstChat]);
        setActiveChatId(firstChat.id);
      }
    } catch (error) {
      console.error("Chat history load error:", error);

      const firstChat = createChat();
      setChats([firstChat]);
      setActiveChatId(firstChat.id);
    }

    setReady(true);
  }, []);

  // Save chats to browser storage
  useEffect(() => {
    if (!ready) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );
    } catch (error) {
      console.error("Chat history save error:", error);
    }
  }, [chats, ready]);

  function updateActiveMessages(nextMessages) {
    setChats((oldChats) =>
      oldChats.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: nextMessages,
              updatedAt: Date.now(),
            }
          : chat
      )
    );
  }

  async function sendMessage(e) {
    e?.preventDefault();

    const text = message.trim();

    if (!text || loading || !activeChatId) return;

    const userMessage = {
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];

    const chatTitle =
      messages.length === 0
        ? text.slice(0, 35)
        : activeChat?.title || "New Chat";

    setChats((oldChats) =>
      oldChats.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              title:
                chat.title === "New Chat"
                  ? chatTitle
                  : chat.title,
              messages: [
                ...nextMessages,
                {
                  role: "assistant",
                  content: "",
                },
              ],
              updatedAt: Date.now(),
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
        const { value, done } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, {
          stream: true,
        });

        fullText += chunk;

        setChats((oldChats) =>
          oldChats.map((chat) => {
            if (chat.id !== activeChatId) {
              return chat;
            }

            const updatedMessages = [...chat.messages];

            updatedMessages[
              updatedMessages.length - 1
            ] = {
              role: "assistant",
              content: fullText,
            };

            return {
              ...chat,
              messages: updatedMessages,
              updatedAt: Date.now(),
            };
          })
        );
      }

      const finalChunk = decoder.decode();

      if (finalChunk) {
        fullText += finalChunk;

        setChats((oldChats) =>
          oldChats.map((chat) => {
            if (chat.id !== activeChatId) {
              return chat;
            }

            const updatedMessages = [...chat.messages];

            updatedMessages[
              updatedMessages.length - 1
            ] = {
              role: "assistant",
              content: fullText,
            };

            return {
              ...chat,
              messages: updatedMessages,
              updatedAt: Date.now(),
            };
          })
        );
      }
    } catch (error) {
      console.error("Chat error:", error);

      setChats((oldChats) =>
        oldChats.map((chat) => {
          if (chat.id !== activeChatId) {
            return chat;
          }

          const updatedMessages = [...chat.messages];

          updatedMessages[
            updatedMessages.length - 1
          ] = {
            role: "assistant",
            content:
              "Sorry, kuch problem aa gayi. Please dobara try karo.",
          };

          return {
            ...chat,
            messages: updatedMessages,
            updatedAt: Date.now(),
          };
        })
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

  function openChat(chatId) {
    if (loading) return;

    setActiveChatId(chatId);
    setMessage("");
  }

  if (!ready) {
    return (
      <main className="app">
        <div
          style={{
            width: "100%",
            display: "grid",
            placeItems: "center",
            minHeight: "100vh",
            color: "#a9a0ad",
          }}
        >
          Loading Chat Sangam...
        </div>
      </main>
    );
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

          {chats.filter(
            (chat) => chat.messages.length > 0
          ).length > 0 ? (
            chats
              .filter(
                (chat) => chat.messages.length > 0
              )
              .slice(0, 10)
              .map((chat) => (
                <button
                  key={chat.id}
                  className="chat-item"
                  onClick={() =>
                    openChat(chat.id)
                  }
                  style={{
                    width: "100%",
                    border: "0",
                    textAlign: "left",
                    cursor: loading
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {chat.title}
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
                          remarkPlugins={[
                            remarkGfm,
                          ]}
                          components={{
                            a: ({
                              node,
                              ...props
                            }) => (
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
