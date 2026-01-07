export type Severity = "red" | "yellow" | "green";

export type Issue = {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  section: string | null;
  evidenceSnippet: string | null;
  recommendation: string | null;
};

export type Publication = {
  authors: string;
  year: number | null;
  title: string;
  journal_or_source: string | null;
  doi_or_pmid: string | null;
  raw_citation: string;
  confidence: number;
};

export type DetectedSection = {
  id: string;
  canonicalHeading: string;
  originalHeading: string;
  content: string;
  startLine: number;
};

export type ValidationResult = {
  overallStatus: Severity;
  issues: Issue[];
  detectedSections: DetectedSection[];
  correctedDraftHtml: string;
  correctedDraftMarkdown: string;
  publications: Publication[];
  lowConfidence: boolean;
};

export type TemplateSection = {
  id: string;
  canonicalHeading: string;
  variants: string[];
  minChars: number;
};

export type TemplateConfig = {
  name: string;
  version: string;
  requiredSections: TemplateSection[];
  optionalSections: TemplateSection[];
  order: string[];
  unknownHeadingHeuristic: {
    maxHeadingLength: number;
    allowAllCaps: boolean;
  };
};

export type ParseResult = {
  text: string;
  lowConfidence: boolean;
};
