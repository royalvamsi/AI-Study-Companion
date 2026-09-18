"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, CheckCircle2, ArrowLeft } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          redirectTo,
        }
      );

      // Handle severe rate-limit or network errors gracefully
      if (resetError) {
        if (
          resetError.status === 429 ||
          resetError.message.toLowerCase().includes("rate limit")
        ) {
          setError(
            "Too many requests. Please wait a few moments before trying again."
          );
          return;
        }
        // For other errors (e.g. user not found depending on Supabase settings),
        // we deliberately do not leak account existence.
      }

      setSubmitted(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6 text-center space-y-3">
          <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="text-emerald-950 text-base font-semibold font-sans">
            Check your email
          </div>
          <p className="text-xs text-emerald-800 leading-relaxed max-w-sm mx-auto font-sans">
            If an account exists for{" "}
            <span className="font-semibold text-emerald-950">{email}</span>,
            we&apos;ve sent a password reset link. Please check your inbox and
            spam folder.
          </p>
        </div>

        <div className="space-y-3 pt-2 text-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 text-xs font-medium text-neutral-600 hover:text-ink transition-colors font-sans"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to sign in</span>
          </Link>

          <div>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setEmail("");
              }}
              className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
            >
              Didn&apos;t receive it? Try another email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs text-red-700 leading-relaxed flex items-start gap-2.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
        >
          Email address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="h-11 pl-10 bg-white border-neutral-200 text-ink placeholder:text-neutral-400 rounded-xl focus-visible:border-orange focus-visible:ring-2 focus-visible:ring-orange/20 transition-colors"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full bg-orange hover:bg-[#d44f19] text-white font-medium h-11 rounded-full text-sm transition-all duration-200 shadow-sm disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed mt-2"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending reset link...
          </>
        ) : (
          "Send reset link"
        )}
      </Button>

      <div className="pt-2 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-ink transition-colors font-sans"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to sign in</span>
        </Link>
      </div>
    </form>
  );
}
