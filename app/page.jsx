"use client";

import { useEffect, useRef, useState } from "react";
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
  const [copiedIndex, setCopiedIndex] = useState(null);

  const messagesEndRef = useRef(null);

  /* =========================
     LOAD CHAT HISTORY
  ========================= */

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

  /* =========================
     SAVE CHAT HISTORY
  ========================= */

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

  /* =========================
     ACTIVE CHAT
  ========================= */

  const activeChat =
    chats.find((chat) => chat.id === activeChatId) ||
    null;

  const messages = activeChat?.messages || [];

  /* =========================
     AUTO SCROLL
  ========================= */

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [messages]);

  /* =========================
     UPDATE ASSISTANT MESSAGE
  ========================= */

  function updateAssistantMessage(
    chatId,
    assistantIndex,
    content
  ) {
    setChats((oldChats) =>
      oldChats.map((chat) => {
        if (chat.id !== chatId) return chat;

        return {
          ...chat,
          messages: chat.messages.map(
            (msg, index) =>
              index === assistantIndex
                ? {
                    ...msg,
                    role: "assistant",
                    content,
                  }
                : msg
          ),
        };
      })
    );
  }

  /* =========================
     STREAM AI RESPONSE
  ========================= */

  async function streamAIResponse(
    chatId,
    apiMessages,
    assistantIndex
  ) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
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

      updateAssistantMessage(
        chatId,
        assistantIndex,
        fullText
      );
    }

    fullText += decoder.decode();

    updateAssistantMessage(
      chatId,
      assistantIndex,
      fullText
    );

    return fullText;
  }

  /* =========================
     SEND MESSAGE
  ========================= */

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

    const assistantIndex =
      nextMessages.length;

    const newTitle =
      messages.length === 0
        ? text.slice(0, 32)
        : activeChat.title;

    const messagesWithAssistant = [
      ...nextMessages,
      {
        role: "assistant",
        content: "",
      },
    ];

    setChats((oldChats) =>
      oldChats.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              title: newTitle,
              messages: messagesWithAssistant,
            }
          : chat
      )
    );

    setMessage("");
    setLoading(true);

    try {
      await streamAIResponse(
        activeChatId,
        nextMessages,
        assistantIndex
      );
    } catch (error) {
      console.error("Chat error:", error);

      updateAssistantMessage(
        activeChatId,
        assistantIndex,
        "Sorry, kuch problem aa gayi. Please dobara try karo."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     REGENERATE RESPONSE
  ========================= */

  async function regenerateResponse() {
    if (loading || !activeChat) return;

    const chatMessages = activeChat.messages;

    if (chatMessages.length === 0) return;

    const lastAssistantIndex =
      chatMessages.length - 1;

    const lastMessage =
      chatMessages[lastAssistantIndex];

    if (lastMessage.role !== "assistant") {
      return;
    }

    const previousMessages =
      chatMessages.slice(0, lastAssistantIndex);

    setChats((oldChats) =>
      oldChats.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: chat.messages.map(
                (msg, index) =>
                  index === lastAssistantIndex
                    ? {
                        ...msg,
                        content: "",
                      }
                    : msg
              ),
            }
          : chat
      )
    );

    setLoading(true);

    try {
      await streamAIResponse(
        activeChatId,
        previousMessages,
        lastAssistantIndex
      );
    } catch (error) {
      console.error(
        "Regenerate error:",
        error
      );

      updateAssistantMessage(
        activeChatId,
        lastAssistantIndex,
        "Sorry, response regenerate nahi ho saka. Please dobara try karo."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     COPY RESPONSE
  ========================= */

  async function copyResponse(
    content,
    index
  ) {
    try {
      await navigator.clipboard.writeText(
        content
      );

      setCopiedIndex(index);

      setTimeout(() => {
        setCopiedIndex(null);
      }, 1500);
    } catch (error) {
      console.error(
        "Copy error:",
        error
      );
    }
  }

  /* =========================
     NEW CHAT
  ========================= */

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

  /* =========================
     OPEN CHAT
  ========================= */

  function openChat(id) {
    if (loading) return;

    setActiveChatId(id);
    setMessage("");
    setMobileMenuOpen(false);
  }

  /* =========================
     MARKDOWN COMPONENTS
  ========================= */

  const markdownComponents = {
    h1: ({ children }) => (
      <h1
        style={{
          fontSize: "1.65rem",
          lineHeight: 1.25,
          margin:
            "18px 0 12px",
          fontWeight: 800,
        }}
      >
        {children}
      </h1>
    ),

    h2: ({ children }) => (
      <h2
        style={{
          fontSize: "1.35rem",
          lineHeight: 1.3,
          margin:
            "18px 0 10px",
          fontWeight: 800,
        }}
      >
        {children}
      </h2>
    ),

    h3: ({ children }) => (
      <h3
        style={{
          fontSize: "1.1rem",
          lineHeight: 1.35,
          margin:
            "16px 0 8px",
          fontWeight: 700,
        }}
      >
        {children}
      </h3>
    ),

    p: ({ children }) => (
      <p
        style={{
          margin:
            "8px 0 12px",
          lineHeight: 1.7,
        }}
      >
        {children}
      </p>
    ),

    ul: ({ children }) => (
      <ul
        style={{
          paddingLeft: "22px",
          margin:
            "10px 0 14px",
          lineHeight: 1.7,
        }}
      >
        {children}
      </ul>
    ),

    ol: ({ children }) => (
      <ol
        style={{
          paddingLeft: "24px",
          margin:
            "10px 0 14px",
          lineHeight: 1.7,
        }}
      >
        {children}
      </ol>
    ),

    li: ({ children }) => (
      <li
        style={{
          marginBottom: "6px",
        }}
      >
        {children}
      </li>
    ),

    strong: ({ children }) => (
      <strong
        style={{
          fontWeight: 800,
        }}
      >
        {children}
      </strong>
    ),

    blockquote: ({ children }) => (
      <blockquote
        style={{
          margin:
            "14px 0",
          padding:
            "10px 14px",
          borderLeft:
            "3px solid #ec4899",
          background:
            "rgba(236,72,153,0.07)",
          borderRadius:
            "6px",
          color: "#d8cdd9",
        }}
      >
        {children}
      </blockquote>
    ),

    hr: () => (
      <hr
        style={{
          border: 0,
          borderTop:
            "1px solid #332638",
          margin:
            "20px 0",
        }}
      />
    ),

    a: ({ children, href }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "#f472b6",
          textDecoration:
            "underline",
        }}
      >
        {children}
      </a>
    ),

    table: ({ children }) => (
      <div
        style={{
          width: "100%",
          overflowX: "auto",
          margin:
            "14px 0",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse:
              "collapse",
            minWidth:
              "420px",
          }}
        >
          {children}
        </table>
      </div>
    ),

    th: ({ children }) => (
      <th
        style={{
          border:
            "1px solid #3a293d",
          padding:
            "9px 10px",
          background:
            "#241627",
          textAlign:
            "left",
          fontWeight: 700,
        }}
      >
        {children}
      </th>
    ),

    td: ({ children }) => (
      <td
        style={{
          border:
            "1px solid #3a293d",
          padding:
            "9px 10px",
          color:
            "#d9d0da",
        }}
      >
        {children}
      </td>
    ),

    code: ({
      children,
      className,
    }) => {
      const isBlock =
        Boolean(className);

      return isBlock ? (
        <code
          className={className}
          style={{
            display: "block",
            overflowX: "auto",
            padding:
              "14px",
            fontSize:
              "13px",
            lineHeight: 1.6,
            color: "#f4d9ec",
            background:
              "#0a070d",
            borderRadius:
              "10px",
          }}
        >
          {children}
        </code>
      ) : (
        <code
          style={{
            padding:
              "2px 6px",
            borderRadius:
              "5px",
            background:
              "#27182b",
            color:
              "#f9a8d4",
            fontSize:
              "0.92em",
          }}
        >
          {children}
        </code>
      );
    },

    pre: ({ children }) => (
      <pre
        style={{
          margin:
            "14px 0",
          overflowX:
            "auto",
          borderRadius:
            "10px",
          border:
            "1px solid #302331",
        }}
      >
        {children}
      </pre>
    ),
  };

  /* =========================
     LOADING SCREEN
  ========================= */

  if (!loaded) {
    return (
      <main className="app">
        <div
          style={{
            width: "100%",
            minHeight: "100vh",
            display: "grid",
            placeItems:
              "center",
            color: "#aaa",
          }}
        >
          Loading Chat Sangam...
        </div>
      </main>
    );
  }

  /* =========================
     MAIN UI
  ========================= */

  return (
    <main className="app">

      {/* =====================
          DESKTOP SIDEBAR
      ====================== */}

      <aside className="sidebar">

        <div className="brand">

          <div className="logo">
            ✦
          </div>

          <div>
            <h1>
              Chat Sangam
            </h1>

            <span>
              AI Assistant
            </span>
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

          <p>
            RECENT CHATS
          </p>

          {chats.length > 0 ? (
            chats
              .slice(0, 10)
              .map((chat) => (
                <button
                  key={chat.id}
                  className="chat-item"
                  onClick={() =>
                    openChat(chat.id)
                  }
                  disabled={loading}
                  style={{
                    width: "100%",
                    border: "0",
                    textAlign:
                      "left",
                    marginBottom:
                      "4px",
                    background:
                      chat.id ===
                      activeChatId
                        ? "#241627"
                        : "#1a111d",
                  }}
                >
                  💬{" "}
                  {chat.title ||
                    "New Chat"}
                </button>
              ))
          ) : (
            <div className="empty-history">
              No conversations yet
            </div>
          )}

        </div>

        <div className="sidebar-bottom">

          <div>
            ⚙ Settings
          </div>

          <div>
            ◉ Account
          </div>

        </div>

      </aside>

      {/* =====================
          MOBILE OVERLAY
      ====================== */}

      {mobileMenuOpen && (
        <div
          onClick={() =>
            setMobileMenuOpen(
              false
            )
          }
          style={{
            position:
              "fixed",
            inset: 0,
            zIndex: 999,
            background:
              "rgba(0,0,0,0.65)",
          }}
        />
      )}

      {/* =====================
          MOBILE DRAWER
      ====================== */}

      {mobileMenuOpen && (
        <div
          style={{
            position:
              "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            width: "285px",
            maxWidth:
              "82vw",
            zIndex: 1000,
            background:
              "#100b16",
            borderRight:
              "1px solid #332638",
            padding:
              "22px 16px",
            boxShadow:
              "15px 0 45px rgba(0,0,0,0.5)",
            overflowY:
              "auto",
          }}
        >

          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              marginBottom:
                "25px",
            }}
          >

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: "10px",
              }}
            >

              <div className="logo">
                ✦
              </div>

              <div>

                <div
                  style={{
                    fontWeight:
                      "bold",
                    fontSize:
                      "17px",
                  }}
                >
                  Chat Sangam
                </div>

                <div
                  style={{
                    color:
                      "#9d91a3",
                    fontSize:
                      "12px",
                  }}
                >
                  AI Assistant
                </div>

              </div>

            </div>

            <button
              onClick={() =>
                setMobileMenuOpen(
                  false
                )
              }
              style={{
                border: 0,
                background:
                  "transparent",
                color: "#aaa",
                fontSize:
                  "25px",
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
              marginBottom:
                "28px",
            }}
          >
            ＋ New Chat
          </button>

          <div className="sidebar-section">

            <p>
              RECENT CHATS
            </p>

            {chats.length > 0 ? (
              chats
                .slice(0, 10)
                .map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() =>
                      openChat(
                        chat.id
                      )
                    }
                    disabled={
                      loading
                    }
                    style={{
                      width:
                        "100%",
                      border: 0,
                      borderRadius:
                        "9px",
                      padding:
                        "12px",
                      marginBottom:
                        "5px",
                      textAlign:
                        "left",
                      color:
                        "#d5cbd7",
                      background:
                        chat.id ===
                        activeChatId
                          ? "#2a1830"
                          : "#1a111d",
                    }}
                  >
                    💬{" "}
                    {chat.title ||
                      "New Chat"}
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
              marginTop:
                "35px",
              display:
                "grid",
              gap: "18px",
              color:
                "#958a99",
              fontSize:
                "14px",
            }}
          >
            <div>
              ⚙ Settings
            </div>

            <div>
