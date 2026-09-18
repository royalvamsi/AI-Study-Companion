import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { Brain, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your free AI Study Companion account.",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 shadow-sm">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              AI Study Companion
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-1">
              <Sparkles className="h-3 w-3 text-indigo-400" />
              Intelligent Workspace for Learning
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-6 sm:p-8 shadow-md space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Create Your Account
            </h2>
            <p className="text-xs text-slate-400">
              Free study workspace with AI-grounded tutoring and adaptive quizzes.
            </p>
          </div>

          <SignupForm />

          <p className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800/60">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
