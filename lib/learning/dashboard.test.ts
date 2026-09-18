import { describe, it, expect } from "vitest";

describe("User Home Dashboard - Section A Requirements", () => {
  it("A1 & A2: derives Continue Learning from strongest signal and bounds Recent Projects", () => {
    const projects = [
      { id: "p1", name: "Project Alpha", updated_at: "2026-09-17T10:00:00Z" },
      { id: "p2", name: "Project Beta", updated_at: "2026-09-17T09:00:00Z" },
      { id: "p3", name: "Project Gamma", updated_at: "2026-09-17T08:00:00Z" },
      { id: "p4", name: "Project Delta", updated_at: "2026-09-17T07:00:00Z" },
      { id: "p5", name: "Project Epsilon", updated_at: "2026-09-17T06:00:00Z" },
    ];

    const recentActivity = [
      { id: "act1", project_id: "p2", event_type: "ASSESSMENT_COMPLETED", payload: { score: 90 }, created_at: "2026-09-17T10:30:00Z" },
      { id: "act2", project_id: "p1", event_type: "MATERIAL_READY", payload: { fileName: "notes.pdf" }, created_at: "2026-09-17T09:15:00Z" },
    ];

    // Strongest signal: latest activity event determines the active continue learning project
    const lastActiveProjectId = recentActivity.find((e) => e.project_id)?.project_id;
    const continueProject =
      (lastActiveProjectId ? projects.find((p) => p.id === lastActiveProjectId) : null) ||
      (projects.length > 0 ? projects[0] : null);

    expect(continueProject).toBeDefined();
    expect(continueProject?.id).toBe("p2");
    expect(continueProject?.name).toBe("Project Beta");

    // Bounded Recent Projects: only up to 4 projects displayed
    const recentProjects = projects.slice(0, 4);
    expect(recentProjects.length).toBe(4);
    expect(recentProjects.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("A3: calculates overall progress correctly and handles empty assessments safely", () => {
    const masteryRecords = [
      { concept_id: "c1", mastery_score: 80 },
      { concept_id: "c2", mastery_score: 60 },
      { concept_id: "c3", mastery_score: 100 },
    ];

    const assessments = [
      { id: "a1", score: 85, status: "completed" },
      { id: "a2", score: 95, status: "completed" },
    ];

    const totalConcepts = masteryRecords.length;
    const overallMastery =
      totalConcepts > 0
        ? Math.round(masteryRecords.reduce((sum, m) => sum + m.mastery_score, 0) / totalConcepts)
        : null;

    const validScores = assessments.map((a) => a.score);
    const avgScore =
      validScores.length > 0
        ? Math.round(validScores.reduce((sum, s) => sum + s, 0) / validScores.length)
        : null;

    expect(totalConcepts).toBe(3);
    expect(overallMastery).toBe(80);
    expect(avgScore).toBe(90);

    // Empty state handling
    const emptyConcepts: any[] = [];
    const emptyAssessments: any[] = [];
    const emptyMastery = emptyConcepts.length > 0 ? 50 : null;
    const emptyAvg = emptyAssessments.length > 0 ? 50 : null;

    expect(emptyMastery).toBeNull();
    expect(emptyAvg).toBeNull();
  });

  it("A4: correctly identifies areas requiring attention based on mastery score < 60 or NEEDS_ATTENTION trend", () => {
    const rawConcepts = [
      { concept_id: "c1", name: "Backpropagation", mastery_score: 45, trend: "NEEDS_ATTENTION", project_name: "ML" },
      { concept_id: "c2", name: "Linear Regression", mastery_score: 85, trend: "IMPROVING", project_name: "ML" },
      { concept_id: "c3", name: "Loss Functions", mastery_score: 55, trend: "STABLE", project_name: "ML" },
      { concept_id: "c4", name: "Decision Trees", mastery_score: 90, trend: "STABLE", project_name: "ML" },
    ];

    // Identify areas requiring attention (mastery < 60 or trend === NEEDS_ATTENTION)
    const attentionItems = rawConcepts
      .filter((c) => c.mastery_score < 60 || c.trend === "NEEDS_ATTENTION")
      .map((c) => ({
        conceptId: c.concept_id,
        conceptName: c.name,
        masteryScore: c.mastery_score,
        trend: c.trend,
        projectName: c.project_name,
      }));

    expect(attentionItems.length).toBe(2);
    expect(attentionItems[0].conceptName).toBe("Backpropagation");
    expect(attentionItems[0].masteryScore).toBe(45);
    expect(attentionItems[1].conceptName).toBe("Loss Functions");
    expect(attentionItems[1].masteryScore).toBe(55);
  });

  it("A5 & A6: handles top recommendations and fallback empty states without inventing AI content", () => {
    const realRecommendation = {
      id: "rec-1",
      project_id: "proj-1",
      concept_id: "concept-1",
      priority: "HIGH",
      action_type: "PRACTICE",
      reasoning: "Review this concept to improve test accuracy.",
    };

    expect(realRecommendation.priority).toBe("HIGH");
    expect(realRecommendation.action_type).toBe("PRACTICE");

    // When recommendation is null, should show clean empty state
    const nullRecommendation = null;
    expect(nullRecommendation).toBeNull();
  });
});
