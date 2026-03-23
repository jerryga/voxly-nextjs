import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voxly",
  description:
    "Voxly turns uploads, transcripts, and AI summaries into a production-ready voice workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
