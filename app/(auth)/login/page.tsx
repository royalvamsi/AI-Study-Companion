import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your AI Study Companion workspace.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F5F3EE] text-ink font-sans antialiased selection:bg-orange/20 selection:text-orange [color-scheme:light] flex flex-col justify-between">
      {/* Top Mobile Brand Header (visible on mobile only) */}
      <header className="lg:hidden px-6 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] bg-ink flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-full border border-orange relative">
              <span className="absolute w-1 h-1 bg-orange rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          <span className="font-semibold text-sm tracking-tight text-ink">
            AI Study Companion
          </span>
        </Link>
        <Link
          href="/signup"
          className="text-xs font-medium text-neutral-600 hover:text-black transition"
        >
          Sign up →
        </Link>
      </header>

      {/* Main 2-Column Content */}
      <main className="flex-1 max-w-[1240px] w-full mx-auto px-6 sm:px-10 py-10 lg:py-16 grid lg:grid-cols-12 items-center gap-12 lg:gap-16">
        {/* LEFT: Editorial Product Message */}
        <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between h-full py-4 pr-6">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-[11px] bg-ink flex items-center justify-center transition-transform group-hover:scale-105">
                <div className="w-4 h-4 rounded-full border border-orange relative">
                  <span className="absolute w-1.5 h-1.5 bg-orange rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
              <span className="font-semibold tracking-tight text-ink">
                AI Study Companion
              </span>
            </Link>
          </div>

          {/* Editorial Statement */}
          <div className="my-auto py-12 max-w-[540px]">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="w-2 h-2 rounded-full bg-orange orange-dot" />
              <span className="text-[11px] uppercase tracking-[.18em] font-semibold text-neutral-500">
                A learning workspace
              </span>
            </div>

            <h1 className="display text-5xl xl:text-6xl leading-[.95] text-ink">
              Learning shouldn&apos;t <em>reset.</em>
            </h1>

            <p className="mt-7 text-lg leading-relaxed text-neutral-600 max-w-[460px]">
              Pick up where you left off. Your learning context stays with you.
            </p>
          </div>

          {/* Footer info note */}
          <div className="text-xs text-neutral-400">
            © 2026 AI Study Companion · Continuity & Context
          </div>
        </div>

        {/* RIGHT: Authentication Form */}
        <div className="lg:col-span-6 xl:col-span-5 w-full max-w-[440px] mx-auto">
          <div className="bg-white rounded-[26px] border border-black/10 p-7 sm:p-10 product-shadow">
            <div className="space-y-2 mb-8">
              <h2 className="display text-3xl sm:text-4xl text-ink leading-tight">
                Welcome back.
              </h2>
              <p className="text-sm text-neutral-500">
                Sign in to continue learning.
              </p>
            </div>

            <LoginForm />

            <div className="mt-8 pt-6 border-t hairline text-center">
              <p className="text-sm text-neutral-500">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="text-ink font-semibold hover:text-orange transition underline decoration-neutral-300 underline-offset-4"
                >
                  Create one free
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile footer */}
      <footer className="lg:hidden px-6 py-6 text-center text-xs text-neutral-400 border-t hairline">
        © 2026 AI Study Companion
      </footer>
    </div>
  );
}
