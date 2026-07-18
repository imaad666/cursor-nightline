import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import Providers from "@/context/Providers";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Kochi Metro Side Quests",
  description: "All you need is this app, and metro.",
  icons: {
    icon: [{ url: "/metro-logo.png", type: "image/png" }],
    shortcut: ["/metro-logo.png"],
    apple: [{ url: "/metro-logo.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
