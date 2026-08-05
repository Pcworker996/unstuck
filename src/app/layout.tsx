import type { Metadata } from "next";

import "./styles.css";

export const metadata: Metadata = {
  title: "Unstuck",
  description: "A private, non-clinical self-regulation companion."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
