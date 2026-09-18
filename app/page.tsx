import type { Metadata } from "next";
import { LandingContent } from "@/components/landing/landing-content";

export const metadata: Metadata = {
  title: "AI Study Companion — Learn with context.",
  description:
    "A learning companion that understands what you're studying, remembers where you are, and helps you decide what to do next.",
};

export default function HomePage() {
  return <LandingContent />;
}
