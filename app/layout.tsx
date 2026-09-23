import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roxx CRM - Sales & Pipeline Management",
  description: "Modern Custom CRM for high-performance sales teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
