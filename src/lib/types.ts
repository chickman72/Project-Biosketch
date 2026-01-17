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

export type ProfessionalPreparation = {
  institution: string;
  location: string;
  degree: string;
  startDate: string; // MM/YYYY
  completionDate: string; // MM/YYYY
  fieldOfStudy: string;
};

export type ContributionToScience = {
  description: string; // max 2000 chars
  products: Publication[]; // up to 4 per contribution
};

export type BiosketchData = {
  personalStatement: string; // max 3500 chars
  contributionsToScience: ContributionToScience[]; // max 5
  products_related_to_project: Publication[]; // max 5
  other_significant_products: Publication[]; // max 5
  professionalPreparation: ProfessionalPreparation[];
  certification: boolean;
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
  biosketchData: Partial<BiosketchData>;
  llmStructuredData: unknown | null;
};

export type TemplateSection = {
  id: string;
  canonicalHeading: string;
  variants: string[];
  minChars?: number;
  maxChars?: number;
  maxEntries?: number;
  maxCharsPerEntry?: number;
  exactText?: string;
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
