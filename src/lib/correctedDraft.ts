import { DetectedSection, TemplateConfig } from "@/lib/types";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateCorrectedDraft(
  sections: DetectedSection[],
  template: TemplateConfig
): { markdown: string; html: string } {
  const sectionById = new Map<string, DetectedSection[]>();
  for (const section of sections) {
    const list = sectionById.get(section.id) ?? [];
    list.push(section);
    sectionById.set(section.id, list);
  }

  const allSections = [...template.requiredSections, ...template.optionalSections];
  const order = template.order.length
    ? template.order
    : allSections.map((section) => section.id);

  const markdownParts: string[] = [];
  const htmlParts: string[] = [];

  for (const sectionId of order) {
    const sectionDef = allSections.find((s) => s.id === sectionId);
    if (!sectionDef) {
      continue;
    }
    const matches = sectionById.get(sectionId);
    const content =
      matches && matches.length
        ? matches.map((match) => match.content).join("\n\n")
        : `TODO: Add ${sectionDef.canonicalHeading}`;

    markdownParts.push(`## ${sectionDef.canonicalHeading}\n\n${content}\n`);
    htmlParts.push(
      `<section><h2>${escapeHtml(
        sectionDef.canonicalHeading
      )}</h2><p>${escapeHtml(content).replace(/\n+/g, "</p><p>")}</p></section>`
    );
  }

  return {
    markdown: markdownParts.join("\n"),
    html: `<div>${htmlParts.join("")}</div>`,
  };
}
