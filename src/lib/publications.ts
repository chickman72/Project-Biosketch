import { Publication } from "@/lib/types";

const doiRegex = /(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i;
const pmidRegex = /\bPMID[:\s]*([0-9]{5,})/i;
const yearRegex = /\b(19|20)\d{2}\b/;

function splitCitationBlocks(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length) {
      blocks.push(current.join(" ").replace(/\s+/g, " ").trim());
      current = [];
    }
  };

  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    if (/^(\d+[\).]|[-*•])\s+/.test(line)) {
      flush();
      current.push(line.replace(/^(\d+[\).]|[-*•])\s+/, ""));
      continue;
    }
    if (current.length === 0) {
      current.push(line);
      continue;
    }
    current.push(line);
  }
  flush();

  return blocks.filter((block) => block.length > 10);
}

function parseCitation(raw: string): Publication {
  const yearMatch = raw.match(yearRegex);
  const year = yearMatch ? Number(yearMatch[0]) : null;

  const doiMatch = raw.match(doiRegex);
  const pmidMatch = raw.match(pmidRegex);
  const doi_or_pmid = doiMatch?.[1] ?? pmidMatch?.[1] ?? null;

  let authors = "";
  let title = "";
  let journal_or_source: string | null = null;

  if (yearMatch) {
    const idx = yearMatch.index ?? -1;
    authors = raw.slice(0, idx).trim().replace(/\s*\($/, '').replace(/[.;,]+$/, '');
    const afterYear = raw.slice(idx + yearMatch[0].length).trim();
    const titleMatch = afterYear.match(/^[\.\s]*([^\.]+)\./);
    if (titleMatch) {
      title = titleMatch[1].trim();
      journal_or_source = afterYear
        .slice(titleMatch[0].length)
        .trim()
        .replace(/^[\.\s]+/, "") || null;
    } else {
      title = afterYear.split(".")[0]?.trim() ?? "";
      journal_or_source = afterYear.split(".").slice(1).join(".").trim() || null;
    }
  } else {
    const firstPeriod = raw.indexOf(".");
    if (firstPeriod > 0) {
      authors = raw.slice(0, firstPeriod).trim();
      const rest = raw.slice(firstPeriod + 1).trim();
      title = rest.split(".")[0]?.trim() ?? "";
      journal_or_source = rest.split(".").slice(1).join(".").trim() || null;
    } else {
      title = raw;
    }
  }

  const confidenceBase = year ? 0.55 : 0.4;
  const confidence =
    confidenceBase + (doi_or_pmid ? 0.25 : 0) + (title ? 0.15 : 0);

  return {
    authors,
    year,
    title,
    journal_or_source,
    doi_or_pmid,
    raw_citation: raw,
    confidence: Math.min(1, Number(confidence.toFixed(2))),
  };
}

export function extractPublications(text: string): Publication[] {
  const blocks = splitCitationBlocks(text);
  return blocks.map(parseCitation);
}

export function formatCitation(pub: Publication): string {
  const year = pub.year ? ` (${pub.year})` : "";
  const title = pub.title ? `${pub.title}. ` : "";
  const journal = pub.journal_or_source ? `${pub.journal_or_source}.` : "";
  const doi = pub.doi_or_pmid ? ` ${pub.doi_or_pmid}` : "";
  return `${pub.authors}${year}. ${title}${journal}${doi}`.replace(/\s+/g, " ").trim();
}
