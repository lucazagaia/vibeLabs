import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vibeLabs · Supplier Risk Buddy",
  description: "Chat with Data Buddy and Research Buddy about Siemens rail suppliers",
};

// Our Tailwind `dark:` classes follow the OS theme directly, but CopilotKit's chat styles key off a
// `dark` class. Mirror the OS theme onto <html> before first paint (and on change) so both agree.
const THEME_SCRIPT = `(()=>{const m=matchMedia("(prefers-color-scheme: dark)");const s=()=>document.documentElement.classList.toggle("dark",m.matches);s();m.addEventListener("change",s)})()`;

// CopilotKit is set up in app/dashboard/layout.tsx, so the landing page loads without it.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The theme script adds `dark` before React hydrates.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
