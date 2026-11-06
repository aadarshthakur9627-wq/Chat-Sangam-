"use client";

import { useState } from "react";
import Script from "next/script";

export default function PricingPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upgrade() {
    setBusy(true);
    setMessage("");
    try {
      const orderResponse = await fetch("/api/billing/order", { method: "POST" });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || "Checkout could not start.");
      if (!window.Razorpay) throw new Error("Secure checkout is loading. Please wait a moment and try again.");

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#d946ef" },
        modal: { ondismiss: () => { setBusy(false); } },
        handler: async () => {
          setMessage("Payment response received. Secure server verification is in progress…");
          for (let attempt = 0; attempt < 8; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const statusResponse = await fetch("/api/billing/status", { cache: "no-store" });
            const status = await statusResponse.json();
            if (statusResponse.ok && status.plan === "pro") {
              setMessage("Chat Sangam Pro is active until " + new Date(status.currentPeriodEnd).toLocaleDateString("en-IN") + ".");
              setBusy(false);
              return;
            }
          }
          setMessage("Payment may be received, but activation is still being verified. Please refresh in a minute; do not pay again while the status is pending.");
          setBusy(false);
        },
      });
      checkout.on("payment.failed", (event) => {
        setMessage(event?.error?.description || "Payment failed. You have not been upgraded.");
        setBusy(false);
      });
      checkout.open();
    } catch (error) {
      setMessage(error.message || "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#09090f", color: "#f8fafc", padding: "32px 18px", fontFamily: "Arial, sans-serif" }}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <a href="/" style={{ color: "#e879f9", textDecoration: "none" }}>← Back to Chat Sangam</a>
        <header style={{ textAlign: "center", padding: "42px 0 28px" }}>
          <p style={{ color: "#e879f9", fontWeight: 700, letterSpacing: 2 }}>CHAT SANGAM PLANS</p>
          <h1 style={{ fontSize: "clamp(32px, 7vw, 52px)", margin: "10px 0" }}>More AI. More room to create.</h1>
          <p style={{ color: "#a1a1aa", fontSize: 17 }}>Simple limits. Verified payments. No fake “unlimited” promises.</p>
        </header>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
          <article style={{ border: "1px solid #27272a", borderRadius: 22, padding: 24, background: "#111119" }}>
            <h2>Free</h2><p style={{ color: "#a1a1aa" }}>Try Chat Sangam</p>
            <p style={{ fontSize: 42, fontWeight: 800, margin: "20px 0" }}>₹0</p>
            <ul style={{ lineHeight: 2, color: "#d4d4d8", paddingLeft: 20 }}><li>5 AI requests per day</li><li>Available free-model routes</li><li>Core chat and supported tools</li></ul>
            <a href="/" style={{ display: "block", textAlign: "center", marginTop: 24, padding: 13, border: "1px solid #3f3f46", borderRadius: 12, color: "#f8fafc", textDecoration: "none" }}>Continue Free</a>
          </article>
          <article style={{ border: "1px solid #c026d3", borderRadius: 22, padding: 24, background: "linear-gradient(160deg,#211027,#111119 65%)" }}>
            <p style={{ color: "#f0abfc", fontWeight: 700 }}>BETA PRO</p><h2>Pro</h2><p style={{ color: "#d4d4d8" }}>For daily study and work</p>
            <p style={{ fontSize: 42, fontWeight: 800, margin: "20px 0" }}>₹149<span style={{ fontSize: 15, color: "#a1a1aa", fontWeight: 400 }}> / 30 days</span></p>
            <ul style={{ lineHeight: 2, color: "#f4e8ff", paddingLeft: 20 }}><li>20 AI requests per day</li><li>30-day Pro entitlement</li><li>Server-verified activation</li><li>Renew manually when it expires</li></ul>
            <button disabled={busy} onClick={upgrade} style={{ width: "100%", marginTop: 24, padding: 14, border: 0, borderRadius: 12, background: busy ? "#6b21a8" : "#d946ef", color: "white", fontSize: 16, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>{busy ? "Processing…" : "Upgrade securely"}</button>
          </article>
        </section>
        <p role="status" aria-live="polite" style={{ marginTop: 22, textAlign: "center", color: "#e9d5ff", lineHeight: 1.6 }}>{message}</p>
        <p style={{ marginTop: 32, textAlign: "center", color: "#71717a", fontSize: 13, lineHeight: 1.7 }}>Pro is a one-time 30-day purchase in this beta, not an auto-renewing subscription. AI provider availability and quotas can change. Sign in before checkout. Payment is activated only after the server verifies the payment webhook.</p>
      </div>
    </main>
  );
}
