import type { Metadata } from "next";
import { Gabarito, Figtree } from "next/font/google";
import { AuthBoot } from "@/components/AuthBoot";
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
  icons: { icon: "/ulat-mark.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's
          cz-shortcut-listen) add attributes to <body> before React hydrates;
          the suppression is one element deep, so real mismatches still warn. */}
      <body
        suppressHydrationWarning
        className={`${gabarito.variable} ${figtree.variable} antialiased`}
      >
        <AuthBoot />
        {children}
      </body>
    </html>
  );
}
