import { describe, expect, it } from "vitest";

import { validateTemplate } from "@/lib/validator";
import { TemplateConfig } from "@/lib/types";

const template: TemplateConfig = {
  name: "Test Template",
  version: "1.0",
  requiredSections: [
    {
      id: "personal_statement",
      canonicalHeading: "Personal Statement",
      variants: ["A. Personal Statement"],
      minChars: 10,
    },
    {
      id: "contributions_science",
      canonicalHeading: "Contributions to Science",
      variants: ["C. Contributions to Science"],
      minChars: 10,
    },
  ],
  optionalSections: [],
  order: ["personal_statement", "contributions_science"],
  unknownHeadingHeuristic: {
    maxHeadingLength: 80,
    allowAllCaps: true,
  },
};

describe("validateTemplate", () => {
  it("flags missing required sections", () => {
    const text = "A. Personal Statement\nThis is enough text.\n";
    const { issues } = validateTemplate(text, template);
    const missing = issues.find((issue) =>
      issue.title.includes("Contributions to Science")
    );
    expect(missing).toBeTruthy();
  });

  it("flags out-of-order sections", () => {
    const text = [
      "C. Contributions to Science",
      "Some contribution text here.",
      "A. Personal Statement",
      "Personal statement text here.",
    ].join("\n");
    const { issues } = validateTemplate(text, template);
    const outOfOrder = issues.find((issue) =>
      issue.title.includes("Out-of-order")
    );
    expect(outOfOrder).toBeTruthy();
  });
});
