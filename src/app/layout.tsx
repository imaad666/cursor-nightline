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
  title: "METRO — Kochi",
  description: "Date spots along the Kochi Metro Blue Line.",
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
