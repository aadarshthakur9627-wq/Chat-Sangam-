import "./globals.css";

export const metadata = {
  title: "Chat Sangam — One workspace. Many AIs.",
  description: "A premium multi-model AI workspace for learning, planning, creating, and coding.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
