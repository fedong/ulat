import type { Metadata } from "next";
import { Gabarito, Figtree } from "next/font/google";
import "./globals.css";

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Ulat — Philippine Gradebook",
  description:
    "Run your classes on the web: grading systems, assessments, attendance, and consultation — with synced student and guardian apps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${gabarito.variable} ${figtree.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
