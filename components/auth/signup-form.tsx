"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, User } from "lucide-react";

export function SignupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split("@")[0] },
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      // If email confirmation is disabled in Supabase, redirect immediately
      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1500);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div className="text-emerald-900 text-base font-semibold">
          Account created!
        </div>
        <div className="text-emerald-700 text-xs">
          Redirecting to your workspace...
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
          htmlFor="displayName"
          className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
        >
          Display name
        </Label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <Input
            id="displayName"
            type="text"
            placeholder="Alex Johnson"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={loading}
            className="h-11 pl-10 bg-white border-neutral-200 text-ink placeholder:text-neutral-400 rounded-xl focus-visible:border-orange focus-visible:ring-2 focus-visible:ring-orange/20 transition-colors"
          />
        </div>
      </div>

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
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="h-11 pl-10 bg-white border-neutral-200 text-ink placeholder:text-neutral-400 rounded-xl focus-visible:border-orange focus-visible:ring-2 focus-visible:ring-orange/20 transition-colors"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="password"
            className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
          >
            Password
          </Label>
          <span className="text-[11px] text-neutral-400">Min. 8 characters</span>
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="h-11 pl-10 bg-white border-neutral-200 text-ink placeholder:text-neutral-400 rounded-xl focus-visible:border-orange focus-visible:ring-2 focus-visible:ring-orange/20 transition-colors"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-orange hover:bg-[#d44f19] text-white font-medium h-11 rounded-full text-sm transition-all duration-200 shadow-sm disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed mt-2"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Create free account"
        )}
      </Button>
    </form>
  );
}
