/**
 * Deterministic concept resolution for adaptive quizzes and learning mastery.
 *
 * Resolves AI-generated concept names against actual database concepts using:
 * 1. Exact case-insensitive matching
 * 2. Punctuation & whitespace normalization
 * 3. Simple singular/plural stemming
 * 4. Unambiguous substring/affix matching (strictly single-match)
 *
 * Never guesses or assigns ambiguous or unrelated concepts.
 */

export type MatchType = "exact" | "normalized" | "stemmed" | "affix" | "unmatched";

export interface ConceptResolutionResult {
  conceptId: string | null;
  matchedConceptName: string | null;
  matchType: MatchType;
}

export interface CandidateConcept {
  id: string;
  name: string;
}

/**
 * Remove punctuation, dashes, underscores, and extra whitespace.
 */
function normalizePunctuation(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-_:/\\,.'"()[\]{}|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Naive singularization of English words (spaces -> space, algorithms -> algorithm, categories -> category).
 */
function toSingularWord(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("ches") || word.endsWith("shes")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && !word.endsWith("is")) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Normalize an entire phrase by lowercasing, stripping punctuation, and singularizing tokens.
 */
function normalizeAndStem(text: string): string {
  const words = normalizePunctuation(text).split(" ");
  return words.map(toSingularWord).join(" ");
}

/**
 * Resolve an AI-generated concept name against available database concepts.
 */
export function resolveConceptForQuestion(
  rawConceptName: string | null | undefined,
  availableConcepts: CandidateConcept[]
): ConceptResolutionResult {
  if (!rawConceptName || typeof rawConceptName !== "string" || !availableConcepts || availableConcepts.length === 0) {
    return { conceptId: null, matchedConceptName: null, matchType: "unmatched" };
  }

  const trimmedRaw = rawConceptName.trim();
  if (!trimmedRaw) {
    return { conceptId: null, matchedConceptName: null, matchType: "unmatched" };
  }

  const lowerRaw = trimmedRaw.toLowerCase();

  // Tier 1: Exact case-insensitive match
  for (const concept of availableConcepts) {
    if (concept.name.trim().toLowerCase() === lowerRaw) {
      return {
        conceptId: concept.id,
        matchedConceptName: concept.name,
        matchType: "exact",
      };
    }
  }

  // Tier 2: Punctuation-normalized match
  const punctRaw = normalizePunctuation(trimmedRaw);
  for (const concept of availableConcepts) {
    if (normalizePunctuation(concept.name) === punctRaw) {
      return {
        conceptId: concept.id,
        matchedConceptName: concept.name,
        matchType: "normalized",
      };
    }
  }

  // Tier 3: Singular / Plural stemmed match
  const stemmedRaw = normalizeAndStem(trimmedRaw);
  for (const concept of availableConcepts) {
    if (normalizeAndStem(concept.name) === stemmedRaw) {
      return {
        conceptId: concept.id,
        matchedConceptName: concept.name,
        matchType: "stemmed",
      };
    }
  }

  // Tier 4: Unambiguous affix / containment match
  // E.g., raw is "Find-S Algorithm Steps" and concept is "Find-S Algorithm",
  // or raw is "Candidate Elimination" and concept is "Candidate Elimination Algorithm"
  const containmentMatches: CandidateConcept[] = [];

  for (const concept of availableConcepts) {
    const conceptStemmed = normalizeAndStem(concept.name);
    if (!conceptStemmed) continue;

    // Check if the concept tokens are a clean sub-sequence in the raw string, or vice-versa
    const rawTokens = stemmedRaw.split(" ");
    const conceptTokens = conceptStemmed.split(" ");

    const isConceptInRaw = stemmedRaw.includes(conceptStemmed);
    const isRawInConcept = conceptStemmed.includes(stemmedRaw);

    if (isConceptInRaw || isRawInConcept) {
      // Safety guard: ensure meaningful token overlap (at least 50% of the longer token list)
      const minOverlapTokens = Math.min(rawTokens.length, conceptTokens.length);
      const maxTokens = Math.max(rawTokens.length, conceptTokens.length);

      if (minOverlapTokens >= 1 && minOverlapTokens / maxTokens >= 0.5) {
        containmentMatches.push(concept);
      }
    }
  }

  // Strictly single-match only: if multiple concepts match, it is ambiguous -> do NOT guess!
  if (containmentMatches.length === 1) {
    const matched = containmentMatches[0];
    return {
      conceptId: matched.id,
      matchedConceptName: matched.name,
      matchType: "affix",
    };
  }

  // If no safe match could be established, return unmatched
  return {
    conceptId: null,
    matchedConceptName: null,
    matchType: "unmatched",
  };
}
