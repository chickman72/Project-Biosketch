import {
  DetectedSection,
  Issue,
  TemplateConfig,
  TemplateSection,
  BiosketchData,
  ProfessionalPreparation,
  ContributionToScience,
} from "@/lib/types";
import { extractPublications } from "./publications";

const markerRegex = /^([A-Z]|[IVX]+|\d+)[.)\s-]+/i;

// PII detection patterns
const piiPatterns = [
  { id: "pii-email", name: "Personal Email", pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g },
  { id: "pii-phone", name: "Phone Number", pattern: /(\(\d{3}\)\s*|\d{3}-)\d{3}-\d{4}/g },
  { id: "pii-address", name: "Home Address", pattern: /\d+\s+[a-zA-Z\s]+?\s+(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|court|ct|lane|ln)\b/i },
  { id: "pii-marital", name: "Marital Status", pattern: /\b(married|single|divorced|widowed)\b/i },
  { id: "pii-hobbies", name: "Hobbies", pattern: /\b(hobbies|hobby|interests|pastimes)\b/i },
];

function checkForPII(text: string): Issue[] {
  const issues: Issue[] = [];
  for (const { id, name, pattern } of piiPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        issues.push({
          id,
          severity: "red",
          title: `Critical Error: Potential PII Detected`,
          description: `The document may contain prohibited personal information: ${name}.`,
          section: null,
          evidenceSnippet: match,
          recommendation: "Remove all personal contact information, such as home address, personal email, or phone numbers, from the document.",
        });
      }
    }
  }
  return issues;
}

function parseProfessionalPreparation(text: string): ProfessionalPreparation[] {
  const entries: ProfessionalPreparation[] = [];
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const dateRegex = /(\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{4})/;

  for (const line of lines) {
    const columnSplit = line.includes("\t")
      ? line.split("\t")
      : line.split(/\s{2,}/);
    const columns = columnSplit.map((item) => item.trim()).filter(Boolean);
    const dateIndex = columns.findIndex((item) => dateRegex.test(item));

    if (columns.length >= 4 && dateIndex > -1) {
      const dateMatch = columns[dateIndex].match(dateRegex);
      if (!dateMatch) continue;
      const institution = columns[0] ?? "";
      const degree = columns[dateIndex - 1] ?? "";
      const location = columns.slice(1, Math.max(1, dateIndex - 1)).join(", ");
      const fieldOfStudy = columns.slice(dateIndex + 1).join(" ").trim();

      const entry: ProfessionalPreparation = {
        institution,
        location,
        degree,
        startDate: dateMatch[1],
        completionDate: dateMatch[2],
        fieldOfStudy,
      };

      if (entry.institution && entry.degree && entry.startDate && entry.completionDate) {
        entries.push(entry);
        continue;
      }
    }

    const dateMatch = line.match(dateRegex);
    if (!dateMatch || dateMatch.index === undefined) {
      continue;
    }
    const left = line.slice(0, dateMatch.index).replace(/[,;]\s*$/, "").trim();
    const right = line.slice(dateMatch.index + dateMatch[0].length).trim();
    const parts = left.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      continue;
    }
    const institution = parts[0];
    const degree = parts[parts.length - 1] ?? "";
    const location = parts.slice(1, -1).join(", ");
    const fieldOfStudy = right.replace(/^[,;\s]+/, "").trim();

    const entry: ProfessionalPreparation = {
      institution,
      location,
      degree,
      startDate: dateMatch[1],
      completionDate: dateMatch[2],
      fieldOfStudy,
    };

    if (entry.institution && entry.degree && entry.startDate && entry.completionDate) {
      entries.push(entry);
    }
  }

  entries.sort((a, b) => {
    const [aMonth, aYear] = a.startDate.split("/");
    const [bMonth, bYear] = b.startDate.split("/");
    if (aYear !== bYear) {
      return parseInt(bYear) - parseInt(aYear);
    }
    return parseInt(bMonth) - parseInt(aMonth);
  });

  return entries;
}


function parseContributions(
  sectionContent: string,
  rules: TemplateSection,
): { contributions: ContributionToScience[], issues: Issue[] } {
  const contributions: ContributionToScience[] = [];
  const issues: Issue[] = [];
  
  // Split the content by numbered entries (e.g., "1. ", "2. ", etc.)
  const entries = sectionContent.split(/\n\s*(?=\d+\.\s)/).filter(s => s.trim());

  if (rules.maxEntries && entries.length > rules.maxEntries) {
    issues.push({
      id: `max-entries-${rules.id}`,
      severity: 'yellow',
      title: `Too many entries in ${rules.canonicalHeading}`,
      description: `Found ${entries.length} entries, but the maximum is ${rules.maxEntries}. Only the first ${rules.maxEntries} will be processed.`,
      section: rules.canonicalHeading,
      evidenceSnippet: null,
      recommendation: `Reduce the number of entries to ${rules.maxEntries}.`
    });
  }

  for (const entryText of entries.slice(0, rules.maxEntries)) {
    // The first part is the description. The rest is publications.
    // This is a heuristic. A more robust solution would be needed for complex cases.
    const parts = entryText.split(/\n\n|\n\s*\n/);
    const descriptionWithNumber = parts[0] || '';
    const description = descriptionWithNumber.replace(/^\d+\.\s*/, '').trim();
    
    if (rules.maxCharsPerEntry && description.length > rules.maxCharsPerEntry) {
        issues.push({
            id: `long-contribution-${rules.id}-${contributions.length}`,
            severity: 'yellow',
            title: 'Contribution description may be too long',
            description: `The description for contribution ${contributions.length + 1} has ${description.length} characters, exceeding the limit of ${rules.maxCharsPerEntry}.`,
            section: rules.canonicalHeading,
            evidenceSnippet: description.slice(0, 140) + '...',
            recommendation: 'Shorten the contribution description.'
        });
    }

    const publicationsText = parts.slice(1).join('\n\n');
    const products = extractPublications(publicationsText);

    if (products.length > 4) {
         issues.push({
            id: `max-products-per-contribution-${rules.id}-${contributions.length}`,
            severity: 'yellow',
            title: 'Too many products for contribution',
            description: `Contribution ${contributions.length + 1} has ${products.length} products, but the maximum is 4.`,
            section: rules.canonicalHeading,
            evidenceSnippet: null,
            recommendation: 'Reduce the number of products for this contribution to 4.'
        });
    }

    contributions.push({
      description,
      products: products.slice(0, 4),
    });
  }

  return { contributions, issues };
}


function normalizeHeading(input: string): string {
  let normalized = input.replace(markerRegex, "").toLowerCase();
  normalized = normalized.replace(/[:\-]+/g, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();

  const repeated = normalized.match(/^(.*)\1$/);
  if (repeated) {
    const firstHalf = repeated[1].trim();
    if (firstHalf) {
      normalized = firstHalf;
    }
  }

  return normalized;
}

function buildHeadingMap(template: TemplateConfig): Map<string, TemplateSection> {
  const map = new Map<string, TemplateSection>();
  const allSections = [...template.requiredSections, ...template.optionalSections];

  for (const section of allSections) {
    const keys = [section.canonicalHeading, ...section.variants];
    for (const key of keys) {
      map.set(normalizeHeading(key), section);
    }
  }

  return map;
}

function buildHeadingKeys(template: TemplateConfig): string[] {
  const map = buildHeadingMap(template);
  const keys = Array.from(map.keys());
  keys.sort((a, b) => b.length - a.length);
  return keys;
}

function isHeadingCandidate(
  line: string,
  maxHeadingLength: number,
  allowAllCaps: boolean
): boolean {
  if (!line) {
    return false;
  }
  const candidate = line.replace(/\s*\(.*$/, "").trim();
  if (!candidate) {
    return false;
  }
  if (candidate.length > maxHeadingLength) {
    return false;
  }
  const hasLetters = /[A-Za-z]/.test(candidate);
  if (!hasLetters) {
    return false;
  }
  const trimmed = candidate.trim();
  const words = trimmed.split(/\s+/);
  if (words.length > 10) {
    return false;
  }
  const commaCount = (trimmed.match(/,/g) || []).length;
  if (commaCount >= 2) {
    return false;
  }
  const allCaps = trimmed === trimmed.toUpperCase();
  if (allCaps && !allowAllCaps) {
    return false;
  }
  return allCaps || /[A-Z][a-z]/.test(trimmed);
}

function isIgnorableHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }
  if (/^omb\s+no\b/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function detectSections(
  text: string,
  template: TemplateConfig
): { sections: DetectedSection[]; unknownHeadings: string[] } {
  const lines = text.split(/\r?\n/);
  const headingMap = buildHeadingMap(template);
  const headingKeys = buildHeadingKeys(template);
  const sections: DetectedSection[] = [];
  const unknownHeadings: string[] = [];

  let current: DetectedSection | null = null;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) {
        current.content += "\n";
      }
      return;
    }

    const normalized = normalizeHeading(trimmed);
    const normalizedStripped = normalizeHeading(trimmed.replace(/\s*\(.*$/, ""));
    let matched =
      headingMap.get(normalized) ?? headingMap.get(normalizedStripped);

    if (
      !matched &&
      isHeadingCandidate(
        trimmed,
        template.unknownHeadingHeuristic.maxHeadingLength,
        template.unknownHeadingHeuristic.allowAllCaps
      )
    ) {
      const candidate = normalizedStripped || normalized;
      const prefixMatch = headingKeys.find((key) => candidate.startsWith(key));
      if (prefixMatch) {
        matched = headingMap.get(prefixMatch);
      } else {
        const containsMatch = headingKeys.find((key) => candidate.includes(key));
        if (containsMatch) {
          matched = headingMap.get(containsMatch);
        }
      }
    }

    if (matched) {
      current = {
        id: matched.id,
        canonicalHeading: matched.canonicalHeading,
        originalHeading: trimmed,
        content: "",
        startLine: index + 1,
      };
      sections.push(current);
      return;
    }

    if (
      !current &&
      isHeadingCandidate(
        trimmed,
        template.unknownHeadingHeuristic.maxHeadingLength,
        template.unknownHeadingHeuristic.allowAllCaps
      )
    ) {
      if (!isIgnorableHeading(trimmed)) {
        unknownHeadings.push(trimmed);
      }
    }

    if (current) {
      current.content += (current.content ? "\n" : "") + trimmed;
    }
  });

  return { sections, unknownHeadings };
}

function preFlightCheck(detectedSections: DetectedSection[]): Issue | null {
    const preFlightHeaders = [
        "professional_preparation",
        "appointments_and_positions",
        "products_related_to_project", // OR other_significant_products
        "contributions_to_science"
    ];

    let foundCount = 0;
    const foundIds = new Set(detectedSections.map(s => s.id));

    if (foundIds.has("professional_preparation")) foundCount++;
    if (foundIds.has("appointments_and_positions")) foundCount++;
    if (foundIds.has("products_related_to_project") || foundIds.has("other_significant_products")) foundCount++;
    if (foundIds.has("contributions_to_science")) foundCount++;

    if (foundCount < 2) { // More than 2 missing
        return {
            id: 'critical-format-error',
            severity: 'red',
            title: 'Critical Format Error',
            description: 'This document does not appear to use the 2026 NIH Common Form template (OMB No. 3145-0279). Validation cannot proceed.',
            section: null,
            evidenceSnippet: null,
            recommendation: 'Rebuild this CV using the standard template. The official SciENcv tool (https://www.ncbi.nlm.nih.gov/sciencv/) is the recommended method for generating a compliant file that matches the "NIH Biographical Sketch Common Form" [cite: 307].'
        };
    }

    return null;
}

export function validateTemplate(
  text: string,
  template: TemplateConfig
): { issues: Issue[]; detectedSections: DetectedSection[]; biosketchData: Partial<BiosketchData> } {
  const { sections, unknownHeadings } = detectSections(text, template);
  
  const preFlightError = preFlightCheck(sections);
  if (preFlightError) {
      return {
          issues: [preFlightError],
          detectedSections: sections,
          biosketchData: {},
      };
  }

  const issues: Issue[] = [];
  const biosketchData: Partial<BiosketchData> = {};

  // PII Check
  issues.push(...checkForPII(text));

  const requiredIds = new Set(template.requiredSections.map((s) => s.id));
  const foundById = new Map<string, DetectedSection[]>();
  for (const section of sections) {
    const list = foundById.get(section.id) ?? [];
    list.push(section);
    foundById.set(section.id, list);
  }

  for (const required of template.requiredSections) {
    if (!foundById.has(required.id)) {
      issues.push({
        id: `missing-${required.id}`,
        severity: "red",
        title: `Missing required section: ${required.canonicalHeading}`,
        description: "This required NIH biosketch section was not detected.",
        section: required.canonicalHeading,
        evidenceSnippet: null,
        recommendation: `Add the section "${required.canonicalHeading}" and include the required content.`,
      });
    }
  }

  const allowDuplicateIds = new Set(["certification_statement"]);
  for (const [sectionId, matches] of foundById.entries()) {
    if (matches.length > 1 && !allowDuplicateIds.has(sectionId)) {
      const canonical =
        matches[0]?.canonicalHeading ||
        template.requiredSections.find((s) => s.id === sectionId)
          ?.canonicalHeading ||
        sectionId;
      issues.push({
        id: `duplicate-${sectionId}`,
        severity: "yellow",
        title: `Duplicate section: ${canonical}`,
        description: "This section appears more than once.",
        section: canonical,
        evidenceSnippet: matches.map((m) => m.originalHeading).join(" | "),
        recommendation: "Merge or remove duplicate sections.",
      });
    }
  }

  const orderIndex = new Map<string, number>();
  template.order.forEach((id, idx) => orderIndex.set(id, idx));
  const orderExemptIds = new Set([
    "certification_statement",
    "nih_biosketch_form",
    "nih_biosketch_supplement",
  ]);
  const ordered = sections
    .map((section) => ({
      id: section.id,
      canonicalHeading: section.canonicalHeading,
      order: orderIndex.get(section.id) ?? Number.POSITIVE_INFINITY,
    }))
    .filter(
      (section) =>
        Number.isFinite(section.order) && !orderExemptIds.has(section.id)
    );

  let lastOrder = -1;
  for (const section of ordered) {
    if (section.order < lastOrder) {
      issues.push({
        id: `order-${section.id}-${section.order}`,
        severity: "yellow",
        title: `Out-of-order section: ${section.canonicalHeading}`,
        description: "This section appears before an expected earlier section.",
        section: section.canonicalHeading,
        evidenceSnippet: null,
        recommendation: "Reorder sections to match the NIH biosketch template.",
      });
    }
    lastOrder = Math.max(lastOrder, section.order);
  }

  const allSections = [...template.requiredSections, ...template.optionalSections];
  const sectionRules = new Map(allSections.map((s) => [s.id, s]));

  for (const section of sections) {
    const rules = sectionRules.get(section.id);
    if (!rules) continue;

    const contentLength = section.content.trim().length;

    if (rules.minChars && contentLength < rules.minChars) {
      issues.push({
        id: `short-${section.id}-${section.startLine}`,
        severity: "yellow",
        title: `Suspiciously short section: ${section.canonicalHeading}`,
        description: `Content length of ${contentLength} characters appears shorter than the recommended minimum of ${rules.minChars} for "${section.canonicalHeading}".`,
        section: section.canonicalHeading,
        evidenceSnippet: section.content.slice(0, 140) || null,
        recommendation: "Confirm the section is complete and add missing detail.",
      });
    }

    if (rules.maxChars && contentLength > rules.maxChars) {
      issues.push({
        id: `long-${section.id}-${section.startLine}`,
        severity: "yellow",
        title: `Section may be too long: ${section.canonicalHeading}`,
        description: `Content length of ${contentLength} characters exceeds the maximum of ${rules.maxChars} for "${section.canonicalHeading}".`,
        section: section.canonicalHeading,
        evidenceSnippet: section.content.slice(0, 140) || null,
        recommendation: "Revise and shorten the content to meet the NIH guideline.",
      });
    }

    if (rules.exactText) {
      const normalizedContent = section.content.replace(/\s+/g, " ").trim();
      const normalizedExact = rules.exactText.replace(/\s+/g, " ").trim();
      if (!normalizedContent.includes(normalizedExact)) {
        issues.push({
            id: `exact-mismatch-${section.id}-${section.startLine}`,
            severity: "red",
            title: `Incorrect statement: ${section.canonicalHeading}`,
            description: `The content for "${section.canonicalHeading}" does not match the required statement.`,
            section: section.canonicalHeading,
            evidenceSnippet: section.content.slice(0, 200) || null,
            recommendation: `Replace the content with the exact required text: "${rules.exactText}"`,
        });
      }
    }

    if (section.id === 'personal_statement') {
        biosketchData.personalStatement = section.content.trim();
    } else if (section.id === 'professional_preparation') {
        biosketchData.professionalPreparation = parseProfessionalPreparation(section.content);
    } else if (section.id === 'contributions_to_science') {
        const { contributions, issues: contribIssues } = parseContributions(section.content, rules);
        issues.push(...contribIssues);
        biosketchData.contributionsToScience = contributions;
    } else if (section.id === 'products_related_to_project') {
        const publications = extractPublications(section.content);
        if (rules.maxEntries && publications.length > rules.maxEntries) {
            issues.push({
                id: `max-entries-${section.id}`,
                severity: 'yellow',
                title: `Too many products in ${section.canonicalHeading}`,
                description: `Found ${publications.length} products, but the maximum is ${rules.maxEntries}.`,
                section: section.canonicalHeading,
                evidenceSnippet: null,
                recommendation: `Reduce the number of products to ${rules.maxEntries}.`
            });
        }
        biosketchData.products_related_to_project = publications.slice(0, rules.maxEntries);
    } else if (section.id === 'other_significant_products') {
        const publications = extractPublications(section.content);
        if (rules.maxEntries && publications.length > rules.maxEntries) {
            issues.push({
                id: `max-entries-${section.id}`,
                severity: 'yellow',
                title: `Too many products in ${section.canonicalHeading}`,
                description: `Found ${publications.length} products, but the maximum is ${rules.maxEntries}.`,
                section: section.canonicalHeading,
                evidenceSnippet: null,
                recommendation: `Reduce the number of products to ${rules.maxEntries}.`
            });
        }
        biosketchData.other_significant_products = publications.slice(0, rules.maxEntries);
    }
  }

  for (const unknown of unknownHeadings) {
    issues.push({
      id: `unknown-${unknown}`,
      severity: "yellow",
      title: "Unknown heading detected",
      description: "Heading was not recognized in the NIH template.",
      section: null,
      evidenceSnippet: unknown,
      recommendation: "Verify the heading or map it to a template section.",
    });
  }

  const certificationRule = template.requiredSections.find(
    (s) => s.id === "certification_statement"
  );
  if (certificationRule) {
    const certSections = sections.filter(
      (s) => s.id === "certification_statement"
    );
    const exactText = certificationRule.exactText;
    if (!exactText) {
      biosketchData.certification = false;
    } else {
      const normalizedExact = exactText.replace(/\s+/g, " ").trim();
      biosketchData.certification = certSections.some((section) =>
        section.content.replace(/\s+/g, " ").trim().includes(normalizedExact)
      );
    }
  }

  return { issues, detectedSections: sections, biosketchData };
}
