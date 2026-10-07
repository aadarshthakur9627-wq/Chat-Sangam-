"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("Chat Sangam route error:", error);
  }, [error]);

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 24,
      background: "#07060a",
      color: "#f7f4fa",
      fontFamily: "system-ui, sans-serif"
    }}>
      <section style={{
        width: "min(520px, 100%)",
        padding: 28,
        border: "1px solid rgba(244,63,140,.22)",
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(244,63,140,.08), rgba(139,92,246,.06))",
        textAlign: "center",
        boxShadow: "0 24px 80px rgba(0,0,0,.45)"
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
        <h1 style={{ margin: "0 0 10px", fontSize: 22 }}>Chat Sangam needs a quick reload</h1>
        <p style={{ margin: "0 auto 20px", color: "#9b93a2", lineHeight: 1.6, fontSize: 13 }}>
          Something unexpected interrupted the page. Your conversations are stored locally. Try again; if it repeats, refresh the browser once.
        </p>
        {error?.digest && (
          <p style={{ margin: "0 0 16px", color: "#625d69", fontSize: 10 }}>
            Error ID: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            border: 0,
            borderRadius: 10,
            padding: "10px 18px",
            color: "#fff",
            background: "linear-gradient(135deg,#f43f8c,#8b5cf6)",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          Try again
        </button>
      </section>
    </main>
  );
}
