import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getGlobalAnalytics } from "@/lib/learning/global-analytics";
import { GlobalAnalyticsContent } from "@/components/analytics/global-analytics-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics — Cross-Project Learning Intelligence",
  description:
    "Aggregated cross-project learning metrics, concept mastery, assessment performance, and AI telemetry.",
};

export default async function GlobalAnalyticsPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const analytics = await getGlobalAnalytics(user.id);

  return <GlobalAnalyticsContent data={analytics} />;
}
