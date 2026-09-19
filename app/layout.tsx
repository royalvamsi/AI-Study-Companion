import type { Metadata } from "next";
import { Inter, DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", weight: "400", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "AI Study Companion", template: "%s | AI Study Companion" },
  description: "AI-powered learning companion that adapts to you — upload materials, chat with an AI tutor, and master concepts through adaptive quizzes.",
  keywords: ["AI", "study", "learning", "tutor", "quiz", "education"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable + " " + dmSans.variable + " " + instrumentSerif.variable + " h-full"}>
      <body className="h-full bg-paper text-ink font-sans antialiased selection:bg-orange/20 selection:text-orange">
        <TooltipProvider>{children}<Toaster /></TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
