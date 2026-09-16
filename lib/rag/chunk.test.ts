import { describe, it, expect } from "vitest";
import { chunkText, chunkTextByPage } from "./chunk";

describe("chunkText", () => {
  it("returns a single chunk when text is shorter than chunkSize", () => {
    const text = "This is a short paragraph of text for testing.";
    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it("splits multiple paragraphs across chunks when exceeding chunkSize", () => {
    const p1 = "A".repeat(80);
    const p2 = "B".repeat(80);
    const fullText = `${p1}\n\n${p2}`;

    const chunks = chunkText(fullText, { chunkSize: 100, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
  });

  it("handles empty strings gracefully", () => {
    const chunks = chunkText("");
    expect(chunks).toHaveLength(0);
  });

  it("handles whitespace-only text gracefully", () => {
    const chunks = chunkText("   \n\n   \n\t  ");
    expect(chunks).toHaveLength(0);
  });
});

describe("chunkTextByPage", () => {
  it("preserves page numbers correctly", () => {
    const pages = [
      { text: "Content on page one.", pageNumber: 1 },
      { text: "Content on page two.", pageNumber: 2 },
    ];

    const chunks = chunkTextByPage(pages);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[0].content).toBe("Content on page one.");
    expect(chunks[1].pageNumber).toBe(2);
    expect(chunks[1].content).toBe("Content on page two.");
  });

  it("skips pages with empty text", () => {
    const pages = [
      { text: "Valid page.", pageNumber: 1 },
      { text: "   ", pageNumber: 2 },
    ];

    const chunks = chunkTextByPage(pages);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageNumber).toBe(1);
  });
});
