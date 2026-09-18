"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Recovery session status
  const [sessionStatus, setSessionStatus] = useState<
    "checking" | "valid" | "invalid"
  >("checking");
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function checkRecoverySession() {
      // 1. Check for error in hash (e.g. #error=access_denied&error_code=otp_expired)
      if (typeof window !== "undefined") {
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const errorDesc = params.get("error_description");
          const errorParam = params.get("error");
          if (errorParam || errorDesc) {
            if (mounted) {
              setSessionStatus("invalid");
              setSessionError(
                errorDesc
                  ? decodeURIComponent(errorDesc.replace(/\+/g, " "))
                  : "Your password reset link is invalid or has expired."
              );
            }
            return;
          }
        }

        // 2. Check for error or code in query parameters
        const search = window.location.search;
        if (search) {
          const params = new URLSearchParams(search);
          const errorDesc = params.get("error_description");
          const errorParam = params.get("error");
          if (errorParam || errorDesc) {
            if (mounted) {
              setSessionStatus("invalid");
              setSessionError(
                errorDesc
                  ? decodeURIComponent(errorDesc.replace(/\+/g, " "))
                  : "Your password reset link is invalid or has expired."
              );
            }
            return;
          }

          const code = params.get("code");
          if (code) {
            const { error: exchangeError } =
              await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              if (mounted) {
                setSessionStatus("invalid");
                setSessionError(
                  "Your password reset link is invalid or has expired. Please request a new one."
                );
              }
              return;
            } else {
              if (mounted) {
                setSessionStatus("valid");
              }
              return;
            }
          }
        }
      }

      // 3. Check for an active session established by Supabase
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        if (mounted) setSessionStatus("valid");
        return;
      }

      // 4. Short grace period (600ms) to allow client-side hash fragment parsing
      const timer = setTimeout(async () => {
        if (!mounted) return;
        const {
          data: { session: retrySession },
        } = await supabase.auth.getSession();

        if (retrySession) {
          setSessionStatus("valid");
        } else {
          setSessionStatus("invalid");
          setSessionError(
            "No active password recovery session was found. Please request a new reset link."
          );
        }
      }, 600);

      return () => clearTimeout(timer);
    }

    // Subscribe to auth state changes (e.g. PASSWORD_RECOVERY event)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionStatus("valid");
        setSessionError(null);
      }
    });

    checkRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match. Please ensure both fields are identical."
      );
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        const msg = updateError.message.toLowerCase();
        if (
          msg.includes("session") ||
          msg.includes("auth") ||
          updateError.status === 401 ||
          updateError.status === 403
        ) {
          setSessionStatus("invalid");
          setSessionError(
            "Your reset session has expired. Please request a new reset link."
          );
          return;
        }
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 2000);
    } catch {
      setError(
        "An unexpected error occurred while updating your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // State 1: Checking recovery session validity
  if (sessionStatus === "checking") {
    return (
      <div className="py-10 text-center space-y-3">
        <Loader2 className="w-6 h-6 text-orange animate-spin mx-auto" />
        <p className="text-xs text-neutral-500 font-sans">
          Verifying your recovery link…
        </p>
      </div>
    );
  }

  // State 2: Invalid or expired recovery link
  if (sessionStatus === "invalid") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-center space-y-3">
          <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-2">
            <AlertCircle className="w-6 h-6 text-rose-600" />
          </div>
          <div className="text-rose-950 text-base font-semibold font-sans">
            Invalid or Expired Link
          </div>
          <p className="text-xs text-rose-800 leading-relaxed font-sans max-w-sm mx-auto">
            {sessionError ||
              "This password reset link is invalid or has expired. For your security, reset links are time-limited."}
          </p>
        </div>

        <div className="space-y-3 pt-2 text-center">
          <Link href="/forgot-password" className="block w-full">
            <Button className="w-full bg-orange hover:bg-[#d44f19] text-white font-medium h-11 rounded-full text-sm transition-all duration-200 shadow-sm cursor-pointer">
              Request a new reset link
            </Button>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-ink transition-colors font-sans"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to sign in</span>
          </Link>
        </div>
      </div>
    );
  }

  // State 3: Password updated successfully
  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6 text-center space-y-3">
          <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="text-emerald-950 text-base font-semibold font-sans">
            Password updated!
          </div>
          <p className="text-xs text-emerald-800 leading-relaxed font-sans">
            Your password has been reset successfully. Redirecting you to your
            account…
          </p>
        </div>

        <div className="pt-2 text-center">
          <Button
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
            className="w-full bg-orange hover:bg-[#d44f19] text-white font-medium h-11 rounded-full text-sm transition-all duration-200 shadow-sm cursor-pointer"
          >
            Continue to Account
          </Button>
        </div>
      </div>
    );
  }

  // State 4: Active recovery session - New password entry form
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

      {/* New Password Input */}
      <div className="space-y-1.5">
        <Label
          htmlFor="new-password"
          className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
        >
          New Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <Input
            id="new-password"
            name="newPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="h-11 pl-10 pr-11 bg-white border-neutral-200 text-ink placeholder:text-neutral-400 rounded-xl focus-visible:border-orange focus-visible:ring-2 focus-visible:ring-orange/20 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={loading}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none focus-visible:text-neutral-700 disabled:opacity-50 cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Confirm Password Input */}
      <div className="space-y-1.5">
        <Label
          htmlFor="confirm-password"
          className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
        >
          Confirm Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <Input
            id="confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            className="h-11 pl-10 pr-11 bg-white border-neutral-200 text-ink placeholder:text-neutral-400 rounded-xl focus-visible:border-orange focus-visible:ring-2 focus-visible:ring-orange/20 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            disabled={loading}
            aria-label={
              showConfirmPassword ? "Hide password" : "Show password"
            }
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none focus-visible:text-neutral-700 disabled:opacity-50 cursor-pointer"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || !password || !confirmPassword}
        className="w-full bg-orange hover:bg-[#d44f19] text-white font-medium h-11 rounded-full text-sm transition-all duration-200 shadow-sm disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed mt-2"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating password...
          </>
        ) : (
          "Update password"
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
