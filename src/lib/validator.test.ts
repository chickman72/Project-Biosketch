import { describe, expect, it, beforeAll } from "vitest";
import { validateTemplate } from "@/lib/validator";
import { loadTemplate } from "@/lib/template";
import { TemplateConfig } from "@/lib/types";

let template: TemplateConfig;

// A helper to add boilerplate headers to bypass the pre-flight check in tests
const withHeaders = (content: string) => `
Professional Preparation
dummy text
Appointments and Positions
dummy text
${content}
`;

beforeAll(async () => {
  template = await loadTemplate();
});

describe("validateTemplate (2026 Rules)", () => {
  it("flags a Critical Error for PII (email)", () => {
    const text = withHeaders("My personal email is test@example.com.");
    const { issues } = validateTemplate(text, template);
    const piiIssue = issues.find((issue) => issue.id === "pii-email");
    expect(piiIssue).toBeTruthy();
    expect(piiIssue?.severity).toBe("red");
  });

  it("flags a Critical Error for PII (phone number)", () => {
    const text = withHeaders("My cell is 555-123-4567.");
    const { issues } = validateTemplate(text, template);
    const piiIssue = issues.find((issue) => issue.id === "pii-phone");
    expect(piiIssue).toBeTruthy();
    expect(piiIssue?.severity).toBe("red");
  });

  it("warns if Personal Statement exceeds character limits", () => {
    const longText = "a".repeat(3501);
    const text = withHeaders(`A. Personal Statement\n${longText}`);
    const { issues } = validateTemplate(text, template);
    const charLimitIssue = issues.find((issue) => issue.id.startsWith("long-personal_statement"));
    expect(charLimitIssue).toBeTruthy();
    expect(charLimitIssue?.severity).toBe("yellow");
  });
  
  it("warns if a Contribution to Science description is too long", () => {
    const longDescription = "a".repeat(2001);
    const text = withHeaders(`Contributions to Science\n1. ${longDescription}`);
    const { issues } = validateTemplate(text, template);
    const charLimitIssue = issues.find((issue) => issue.id.startsWith("long-contribution-contributions_to_science"));
    expect(charLimitIssue).toBeTruthy();
    expect(charLimitIssue?.severity).toBe("yellow");
  });
  
  it("warns if there are too many 'Other Significant Products'", () => {
    const products = Array(6).fill("1. Author A. (2023). Title. Journal. DOI: 10.1234/5678").join("\n\n");
    const text = withHeaders(`Other Significant Products\n${products}`);
    const { issues } = validateTemplate(text, template);
    const maxEntriesIssue = issues.find((issue) => issue.id.startsWith("max-entries-other_significant_products"));
    expect(maxEntriesIssue).toBeTruthy();
  });

  it("flags an incorrect certification statement", () => {
    const text = withHeaders("Certification\nI certify that this is mostly correct.");
    const { issues, biosketchData } = validateTemplate(text, template);
    const certIssue = issues.find((issue) => issue.id.startsWith("exact-mismatch-certification_statement"));
    expect(certIssue).toBeTruthy();
    expect(certIssue?.severity).toBe("red");
    expect(biosketchData.certification).toBe(false);
  });

  it("correctly parses and sorts the Professional Preparation section", () => {
    const text = `
Personal Statement
This is a short personal statement for testing.

Professional Preparation
UAB, Birmingham, AL, PhD, 08/2018 - 05/2023, Biomedical Engineering
Stanford University, Stanford, CA, BS, 08/2014 - 05/2018, Biology

Appointments and Positions
dummy text

Contributions to Science
1. A brief contribution description for tests.

Products Related to This Project
dummy text

Other Significant Products
dummy text

Certification
I certify that the information provided is current, accurate, and complete. This includes but is not limited to information related to domestic and foreign appointments and positions.
    `;
    const { biosketchData, issues } = validateTemplate(text, template);
    const redIssues = issues.filter(i => i.severity === 'red');
    expect(redIssues).toHaveLength(0);
    expect(biosketchData.professionalPreparation).toHaveLength(2);
    expect(biosketchData.professionalPreparation?.[0]?.institution).toBe("UAB");
    expect(biosketchData.professionalPreparation?.[1]?.institution).toBe("Stanford University");
  });

  it("correctly parses a Contribution to Science entry", () => {
    const text = withHeaders(`
Contributions to Science
1. This is the description of my first contribution. It is very important.

First Author, et al. (2022). A study on things. Science. PMID: 123456

Another Author, et al. (2021). A different study. Nature.
    `);
    const { biosketchData, issues } = validateTemplate(text, template);
    const relevantIssues = issues.filter(i => i.section === 'Contributions to Science' && i.severity !== 'green');
    expect(relevantIssues).toHaveLength(0);
    expect(biosketchData.contributionsToScience).toHaveLength(1);
    const firstContribution = biosketchData.contributionsToScience?.[0];
    expect(firstContribution?.description).toContain("This is the description");
    expect(firstContribution?.products).toHaveLength(2);
    expect(firstContribution?.products[0]?.authors).toBe("First Author, et al");
  });
  
  it("returns a single critical format error if key sections are missing", () => {
    const text = `
A. Personal Statement
This is a biosketch, but it's not in the right format.
    `;
    const { issues } = validateTemplate(text, template);
    expect(issues).toHaveLength(1);
    const criticalError = issues[0];
    expect(criticalError.id).toBe('critical-format-error');
    expect(criticalError.severity).toBe('red');
    expect(criticalError.title).toBe('Critical Format Error');
    expect(criticalError.recommendation).toContain('https://www.ncbi.nlm.nih.gov/sciencv/');
  });

  it("passes a valid biosketch with all sections", () => {
    const validText = `
Personal Statement
This is my personal statement. It is a reasonable length.

Professional Preparation
University of Science, City, ST, PhD, 08/2018 - 05/2023, Data Science

Appointments and Positions
Some valid text.

Contributions to Science
1. My one contribution.

Products Related to Project
1. Relevant Product 1. (2022). Journal.

Other Significant Products
1. Other Product 1. (2021). Journal.

Certification
I certify that the information provided is current, accurate, and complete. This includes but is not limited to information related to domestic and foreign appointments and positions.
    `;
    const { issues, biosketchData } = validateTemplate(validText, template);
    const redIssues = issues.filter(issue => issue.severity === 'red');
    expect(redIssues).toHaveLength(0);
    expect(biosketchData.personalStatement).toBeDefined();
    expect(biosketchData.professionalPreparation).toHaveLength(1);
    expect(biosketchData.contributionsToScience).toHaveLength(1);
    expect(biosketchData.products_related_to_project).toHaveLength(1);
    expect(biosketchData.other_significant_products).toHaveLength(1);
    expect(biosketchData.certification).toBe(true);
  });

  it("returns a critical format error if only one key section is present", () => {
    const text = `
Professional Preparation
Some details here.
    `;
    const { issues } = validateTemplate(text, template);
    expect(issues).toHaveLength(1);
    const criticalError = issues[0];
    expect(criticalError.id).toBe('critical-format-error');
  });

  it("passes pre-flight check if two key sections are present", () => {
    const text = `
Professional Preparation
Some details here.

Appointments and Positions
Some other details.
    `;
    const { issues } = validateTemplate(text, template);
    const criticalError = issues.find(i => i.id === 'critical-format-error');
    expect(criticalError).toBeUndefined();
  });
});
