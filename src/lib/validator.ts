import {
  DetectedSection,
  Issue,
  TemplateConfig,
  TemplateSection,
} from "@/lib/types";

const markerRegex = /^([A-Z]|[IVX]+|\d+)[.)\s-]+/i;

function normalizeHeading(input: string): string {
  return input
    .replace(markerRegex, "")
    .replace(/[:\-–—]+$/, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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
  if (line.length > maxHeadingLength) {
    return false;
  }
  const hasLetters = /[A-Za-z]/.test(line);
  if (!hasLetters) {
    return false;
  }
  const trimmed = line.trim();
  const words = trimmed.split(/\s+/);
  if (words.length > 10) {
    return false;
  }
  const allCaps = trimmed === trimmed.toUpperCase();
  if (allCaps && !allowAllCaps) {
    return false;
  }
  return allCaps || /[A-Z][a-z]/.test(trimmed);
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
      isHeadingCandidate(
        trimmed,
        template.unknownHeadingHeuristic.maxHeadingLength,
        template.unknownHeadingHeuristic.allowAllCaps
      )
    ) {
      unknownHeadings.push(trimmed);
    }

    if (current) {
      current.content += (current.content ? "\n" : "") + trimmed;
    }
  });

  return { sections, unknownHeadings };
}

export function validateTemplate(
  text: string,
  template: TemplateConfig
): { issues: Issue[]; detectedSections: DetectedSection[] } {
  const { sections, unknownHeadings } = detectSections(text, template);
  const issues: Issue[] = [];

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

  for (const [sectionId, matches] of foundById.entries()) {
    if (matches.length > 1) {
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
  const ordered = sections
    .map((section) => ({
      id: section.id,
      canonicalHeading: section.canonicalHeading,
      order: orderIndex.get(section.id) ?? Number.POSITIVE_INFINITY,
    }))
    .filter((section) => Number.isFinite(section.order));

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
  const minCharsMap = new Map(allSections.map((s) => [s.id, s.minChars]));

  for (const section of sections) {
    const minChars = minCharsMap.get(section.id);
    if (minChars && section.content.replace(/\s+/g, "").length < minChars) {
      issues.push({
        id: `short-${section.id}-${section.startLine}`,
        severity: "yellow",
        title: `Suspiciously short section: ${section.canonicalHeading}`,
        description: `Content length appears shorter than expected for "${section.canonicalHeading}".`,
        section: section.canonicalHeading,
        evidenceSnippet: section.content.slice(0, 140) || null,
        recommendation: "Confirm the section is complete and add missing detail.",
      });
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

  return { issues, detectedSections: sections };
}
