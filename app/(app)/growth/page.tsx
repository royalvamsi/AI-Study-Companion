import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { GrowthContent } from "@/components/growth/growth-content";
import { generateGrowthNarrative } from "@/lib/ai/growth-summary";
import { GrowthSummary, ConceptTrend } from "@/lib/learning/growth";
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
  const { data: allMasteryRaw } = await (supabase.from("concept_mastery") as any)
    .select("project_id, concept_id, mastery_score, trend, assessment_count, concepts(name)")
    .eq("user_id", user.id)
    .order("mastery_score", { ascending: false });

  const allMastery = allMasteryRaw ?? [];

  // Deterministically compute GrowthSummary across all user concepts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const improving = allMastery.filter((m: any) => m.trend === "IMPROVING").map((m: any) => ({
    conceptId: m.concept_id,
    conceptName: m.concepts?.name ?? "Concept",
    currentScore: m.mastery_score,
    previousScore: null,
    trend: "IMPROVING" as ConceptTrend,
    assessmentCount: m.assessment_count,
    lastAssessedAt: null,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const needsAttention = allMastery.filter((m: any) => m.trend === "NEEDS_ATTENTION").map((m: any) => ({
    conceptId: m.concept_id,
    conceptName: m.concepts?.name ?? "Concept",
    currentScore: m.mastery_score,
    previousScore: null,
    trend: "NEEDS_ATTENTION" as ConceptTrend,
    assessmentCount: m.assessment_count,
    lastAssessedAt: null,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stable = allMastery.filter((m: any) => m.trend === "STABLE").map((m: any) => ({
    conceptId: m.concept_id,
    conceptName: m.concepts?.name ?? "Concept",
    currentScore: m.mastery_score,
    previousScore: null,
    trend: "STABLE" as ConceptTrend,
    assessmentCount: m.assessment_count,
    lastAssessedAt: null,
  }));

  let overallTrend: ConceptTrend = "STABLE";
  if (improving.length > needsAttention.length * 2) overallTrend = "IMPROVING";
  else if (needsAttention.length > improving.length) overallTrend = "NEEDS_ATTENTION";

  const growthSummary: GrowthSummary = {
    improving,
    stable,
    needsAttention,
    overallTrend,
  };

  const narrative = await generateGrowthNarrative({
    userId: user.id,
    growthSummary,
  });

  return (
    <GrowthContent
      projects={projects ?? []}
      mastery={allMastery}
      narrative={narrative}
    />
  );
}
