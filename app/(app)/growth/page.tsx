import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { GrowthContent } from "@/components/growth/growth-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Growth",
  description: "Track your concept mastery and learning progress over time.",
};

export default async function GrowthPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projects } = await (supabase.from("projects") as any)
    .select("id, name")
    .eq("user_id", user.id)
    .order("name");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allMastery } = await (supabase.from("concept_mastery") as any)
    .select("project_id, concept_id, mastery_score, trend, assessment_count, concepts(name)")
    .eq("user_id", user.id)
    .order("mastery_score", { ascending: false });

  return (
    <GrowthContent
      projects={projects ?? []}
      mastery={allMastery ?? []}
    />
  );
}
