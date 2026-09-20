import "./globals.css";

export const metadata = {
  title: "Chat Sangam",
  description: "AI Assistant powered by Groq and Gemini",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
