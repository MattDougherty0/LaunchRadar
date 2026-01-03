import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaunchRadar",
  description: "Track competitor product launches and updates",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
