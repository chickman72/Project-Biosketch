import { parseDocx } from "@/lib/parsers/docx";
import { parsePdf } from "@/lib/parsers/pdf";
import { generateCorrectedDraft } from "@/lib/correctedDraft";
import { createLLMEnhancer } from "@/lib/llmEnhancer";
import { extractPublications } from "@/lib/publications";
import { loadTemplate } from "@/lib/template";
import { validateTemplate } from "@/lib/validator";
import { ParseResult, ValidationResult } from "@/lib/types";

function pickParser(fileType: string) {
  if (fileType.includes("wordprocessingml")) {
    return "docx";
  }
  if (fileType.includes("pdf")) {
    return "pdf";
  }
  return "unknown";
}

export async function processBiosketchFile(
  buffer: Buffer,
  fileType: string
): Promise<ValidationResult> {
  const parser = pickParser(fileType);
  let parsed: ParseResult;

  if (parser === "docx") {
    parsed = await parseDocx(buffer);
  } else if (parser === "pdf") {
    parsed = await parsePdf(buffer);
  } else {
    throw new Error("Unsupported file type");
  }

  const enhancer = createLLMEnhancer();
  const enhancedText = enhancer.enabled
    ? await enhancer.enhanceHeadings(parsed.text)
    : parsed.text;

  const template = await loadTemplate();
  const { issues, detectedSections } = validateTemplate(enhancedText, template);

  const publicationSections = detectedSections.filter((section) =>
    ["contributions_science", "publications"].includes(section.id)
  );
  const rawPublicationText = publicationSections
    .map((section) => section.content)
    .join("\n\n");

  const publicationBlocks = rawPublicationText
    ? rawPublicationText.split(/\n{2,}/)
    : [];
  const enhancedCitations = enhancer.enabled
    ? await enhancer.enhanceCitations(publicationBlocks)
    : publicationBlocks;
  const publications = extractPublications(enhancedCitations.join("\n\n"));

  const corrected = generateCorrectedDraft(detectedSections, template);

  const overallStatus = issues.some((issue) => issue.severity === "red")
    ? "red"
    : issues.some((issue) => issue.severity === "yellow")
    ? "yellow"
    : "green";

  return {
    overallStatus,
    issues,
    detectedSections,
    correctedDraftHtml: corrected.html,
    correctedDraftMarkdown: corrected.markdown,
    publications,
    lowConfidence: parsed.lowConfidence,
  };
}
