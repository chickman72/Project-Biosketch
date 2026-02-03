import {
  BiosketchData,
  ContributionToScience,
  DetectedSection,
  ProfessionalPreparation,
  Publication,
  TemplateConfig,
} from "@/lib/types";
import { formatCitation } from "@/lib/publications";

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
  template: TemplateConfig,
  biosketchData: Partial<BiosketchData> = {},
  llmStructuredData: unknown | null = null
): { markdown: string; html: string } {
  const sectionById = new Map<string, DetectedSection[]>();
  for (const section of sections) {
    const list = sectionById.get(section.id) ?? [];
    list.push(section);
    sectionById.set(section.id, list);
  }

  const allSections = [...template.requiredSections, ...template.optionalSections];

  const markdownParts: string[] = [];
  const htmlParts: string[] = [];
  const commonFormParts: string[] = [];
  const supplementParts: string[] = [];

  const css = `<style>
    .nih-biosketch {
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.2;
      padding: 24px;
    }
    .nih-biosketch .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 12px;
    }
    .nih-biosketch .header-list {
      display: grid;
      gap: 4px;
    }
    .nih-biosketch .omb {
      text-align: right;
      font-size: 9pt;
    }
    .nih-biosketch .section {
      margin-bottom: 14px;
    }
    .nih-biosketch h1 {
      font-size: 12pt;
      font-weight: bold;
      text-align: center;
      margin: 0 0 10px;
    }
    .nih-biosketch h2 {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      background: #e6e6e6;
      padding: 4px 6px;
      margin: 12px 0 6px;
    }
    .nih-biosketch .instruction-label {
      font-size: 9pt;
      font-style: italic;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 8px 0 4px;
    }
    .nih-biosketch h3 {
      font-size: 11pt;
      font-weight: bold;
      margin: 8px 0 4px;
    }
    .nih-biosketch p {
      margin: 0 0 6px;
    }
    .nih-biosketch .placeholder {
      font-style: italic;
    }
    .nih-biosketch table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0 10px;
    }
    .nih-biosketch th,
    .nih-biosketch td {
      border: 1px solid #000000;
      padding: 8px;
      vertical-align: top;
      text-align: left;
    }
    .nih-biosketch .appointments-table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0 10px;
    }
    .nih-biosketch .appointments-table td {
      border: none;
      padding: 4px 6px;
      vertical-align: top;
    }
    .nih-biosketch .appointments-table .timeframe {
      width: 150px;
      white-space: nowrap;
    }
    .nih-biosketch ol {
      margin: 0 0 6px 18px;
      padding: 0;
    }
    .nih-biosketch li {
      margin: 0 0 4px;
    }
    .nih-biosketch .cert-footer {
      font-size: 9.5pt;
      margin-top: 6px;
      border-top: 1px solid #000000;
      padding-top: 4px;
    }
    .nih-biosketch * {
      color: #000000;
    }
    #supplement {
      page-break-before: always;
      break-before: page;
    }
  </style>`;

  const escapeOrPlaceholder = (content: string, placeholder: string) => {
    if (!content.trim()) {
      return `<p class="placeholder">${escapeHtml(placeholder)}</p>`;
    }
    return renderParagraphsHtml(content);
  };

  const renderParagraphsHtml = (content: string) => {
    const paragraphs = content
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    if (!paragraphs.length) {
      return "";
    }
    return paragraphs
      .map(
        (paragraph) =>
          `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`
      )
      .join("");
  };

  const renderPublicationListHtml = (
    publications: Publication[] | undefined,
    fallbackContent: string,
    placeholder: string
  ) => {
    if (publications && publications.length) {
      return `<ol>${publications
        .map((pub) => `<li>${escapeHtml(formatCitation(pub))}</li>`)
        .join("")}</ol>`;
    }
    return escapeOrPlaceholder(fallbackContent, placeholder);
  };




  const buildPrepRowsFromContent = (content: string) => {
    if (!content.trim()) {
      return [];
    }
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const rows: {
      institutionAndLocation: string;
      degree: string;
      startDate: string;
      completionDate: string;
      fieldOfStudy: string;
    }[] = [];

    const degreeKeywordRegex =
      /\b(phd|dphil|md|dds|dmd|dvm|mph|ms|msc|ma|mba|bs|ba|bsc|bfa|beng|jd|pharmd|postdoc|postdoctoral|fellowship|doctor|master|bachelor)\b/i;

    const normalizeDate = (value: string) => value.replace(/[^0-9/]/g, "");

    const findDateRange = (text: string) => {
      const cleaned = text.replace(/[^0-9/\s-]/g, "");
      let match = cleaned.match(/(\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{4})/);
      if (!match) {
        match = cleaned.match(/(\d{2}\/\d{4}).*?(\d{2}\/\d{4})/);
      }
      if (!match) {
        return null;
      }
      return { start: match[1], end: match[2] };
    };

    for (const line of lines) {
      const columns = line.includes("\t")
        ? line.split("\t").map((item) => item.trim()).filter(Boolean)
        : line.split(/\s{2,}/).map((item) => item.trim()).filter(Boolean);
      if (columns.length < 5) {
        continue;
      }
      const lower = line.toLowerCase();
      if (
        lower.includes("institution") &&
        lower.includes("degree") &&
        lower.includes("field")
      ) {
        continue;
      }
      rows.push({
        institutionAndLocation: columns[0],
        degree: columns[1],
        startDate: normalizeDate(columns[2]),
        completionDate: normalizeDate(columns[3]),
        fieldOfStudy: columns.slice(4).join(" "),
      });
    }
    if (rows.length) {
      return rows;
    }

    const cleanedLines = lines.filter((line) => {
      const lower = line.toLowerCase();
      return !(
        lower.includes("institution") &&
        lower.includes("degree") &&
        lower.includes("field")
      );
    });

    const rowLines: string[][] = [];
    let current: string[] = [];
    let hasDates = false;

    const isInstitutionStart = (line: string) =>
      /\b(university|college|institute|school|center|centre|hospital)\b/i.test(
        line
      );

    for (const line of cleanedLines) {
      if (current.length && hasDates && isInstitutionStart(line)) {
        rowLines.push(current);
        current = [];
        hasDates = false;
      }
      current.push(line);
      if (findDateRange(line)) {
        hasDates = true;
      }
    }
    if (current.length) {
      rowLines.push(current);
    }

    const fallbackRows = rowLines
      .map((entryLines) => {
        const dateLineIndex = entryLines.findIndex((line) =>
          Boolean(findDateRange(line))
        );
        if (dateLineIndex === -1) {
          return null;
        }
        const degreeStartIndex = entryLines.findIndex((line) =>
          degreeKeywordRegex.test(line)
        );
        const institutionLines =
          degreeStartIndex > -1
            ? entryLines.slice(0, degreeStartIndex)
            : entryLines.slice(0, dateLineIndex);
        const degreeLines =
          degreeStartIndex > -1 && degreeStartIndex < dateLineIndex
            ? entryLines.slice(degreeStartIndex, dateLineIndex)
            : [];

        const dateText = entryLines.slice(dateLineIndex).join(" ");
        const dateMatch = findDateRange(dateText);
        if (!dateMatch) {
          return null;
        }
        const dateRemainder = dateText
          .replace(dateMatch.start, "")
          .replace(dateMatch.end, "")
          .replace(/-/, "")
          .trim();
        const fieldLines = entryLines
          .slice(dateLineIndex + 1)
          .join(" ")
          .trim();
        const cleanedRemainder = dateRemainder
          .replace(/[^A-Za-z0-9,.;:/() -]+/g, "")
          .trim();
        const fieldOfStudy = [cleanedRemainder, fieldLines]
          .filter(Boolean)
          .join(" ")
          .trim();

        return {
          institutionAndLocation: institutionLines.join(" ").trim(),
          degree: degreeLines.join(" ").trim(),
          startDate: dateMatch.start,
          completionDate: dateMatch.end,
          fieldOfStudy,
        };
      })
      .filter((row): row is {
        institutionAndLocation: string;
        degree: string;
        startDate: string;
        completionDate: string;
        fieldOfStudy: string;
      } => Boolean(row));

    return fallbackRows;
  };

  const renderProfessionalPreparationHtml = (
    prep: ProfessionalPreparation[] | undefined,
    fallbackContent: string,
    placeholder: string
  ) => {
    const fallbackRows = buildPrepRowsFromContent(fallbackContent);
    if (prep && prep.length) {
      return `<table>
        <thead>
          <tr>
            <th>INSTITUTION AND LOCATION</th>
            <th>DEGREE</th>
            <th>Start Date (MM/YYYY)</th>
            <th>Completion Date (MM/YYYY)</th>
            <th>FIELD OF STUDY</th>
          </tr>
        </thead>
        <tbody>
          ${prep
            .map(
              (entry) => `<tr>
              <td>${escapeHtml(
                [entry.institution, entry.location].filter(Boolean).join(", ")
              )}</td>
              <td>${escapeHtml(entry.degree)}</td>
              <td>${escapeHtml(entry.startDate)}</td>
              <td>${escapeHtml(entry.completionDate)}</td>
              <td>${escapeHtml(entry.fieldOfStudy)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
    }
    if (fallbackRows.length) {
      return `<table>
        <thead>
          <tr>
            <th>INSTITUTION AND LOCATION</th>
            <th>DEGREE</th>
            <th>Start Date (MM/YYYY)</th>
            <th>Completion Date (MM/YYYY)</th>
            <th>FIELD OF STUDY</th>
          </tr>
        </thead>
        <tbody>
          ${fallbackRows
            .map(
              (row) => `<tr>
              <td>${escapeHtml(row.institutionAndLocation)}</td>
              <td>${escapeHtml(row.degree)}</td>
              <td>${escapeHtml(row.startDate)}</td>
              <td>${escapeHtml(row.completionDate)}</td>
              <td>${escapeHtml(row.fieldOfStudy)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
    }
    return escapeOrPlaceholder(fallbackContent, placeholder);
  };

  const renderContributionsHtml = (
    contributions: ContributionToScience[] | undefined,
    fallbackContent: string,
    placeholder: string
  ) => {
    if (contributions && contributions.length) {
      return contributions
        .map((contribution, idx) => {
          const products = contribution.products || [];
          const productsHtml = products.length
            ? `<ol>${products
                .map((pub) => `<li>${escapeHtml(formatCitation(pub))}</li>`)
                .join("")}</ol>`
            : "";
          return `<div class="section">
            <p><strong>${idx + 1}. </strong>${escapeHtml(
              contribution.description
            )}</p>
            ${productsHtml}
          </div>`;
        })
        .join("");
    }
    return escapeOrPlaceholder(fallbackContent, placeholder);
  };

  const renderSupplementContributionsHtml = (
    contributions: ContributionToScience[] | undefined,
    fallbackContent: string,
    placeholder: string
  ) => {
    if (contributions && contributions.length) {
      return contributions
        .map((contribution, idx) => {
          const products = contribution.products || [];
          const productsHtml = products.length
            ? `<ol>${products
                .map((pub) => `<li>${escapeHtml(formatCitation(pub))}</li>`)
                .join("")}</ol>`
            : "";
          return `<div class="section">
            <h3>Contribution ${idx + 1}</h3>
            <p>${escapeHtml(contribution.description)}</p>
            ${productsHtml}
          </div>`;
        })
        .join("");
    }
    return escapeOrPlaceholder(fallbackContent, placeholder);
  };

  const renderPublicationListMarkdown = (
    publications: Publication[] | undefined,
    fallbackContent: string,
    placeholder: string
  ) => {
    if (publications && publications.length) {
      return publications
        .map((pub, idx) => `${idx + 1}. ${formatCitation(pub)}`)
        .join("\n");
    }
    return fallbackContent.trim() ? fallbackContent : `*${placeholder}*`;
  };

  const renderProfessionalPreparationMarkdown = (
    prep: ProfessionalPreparation[] | undefined,
    fallbackContent: string,
    placeholder: string
  ) => {
    const fallbackRows = buildPrepRowsFromContent(fallbackContent);
    if (prep && prep.length) {
      const header =
        "| INSTITUTION AND LOCATION | DEGREE | Start Date (MM/YYYY) | Completion Date (MM/YYYY) | FIELD OF STUDY |";
      const divider = "| --- | --- | --- | --- | --- |";
      const rows = prep.map(
        (entry) =>
          `| ${[entry.institution, entry.location].filter(Boolean).join(", ")} | ${entry.degree} | ${entry.startDate} | ${entry.completionDate} | ${entry.fieldOfStudy} |`
      );
      return [header, divider, ...rows].join("\n");
    }
    if (fallbackRows.length) {
      const header =
        "| INSTITUTION AND LOCATION | DEGREE | Start Date (MM/YYYY) | Completion Date (MM/YYYY) | FIELD OF STUDY |";
      const divider = "| --- | --- | --- | --- | --- |";
      const rows = fallbackRows.map(
        (row) =>
          `| ${row.institutionAndLocation} | ${row.degree} | ${row.startDate} | ${row.completionDate} | ${row.fieldOfStudy} |`
      );
      return [header, divider, ...rows].join("\n");
    }
    return fallbackContent.trim() ? fallbackContent : `*${placeholder}*`;
  };

  const renderContributionsMarkdown = (
    contributions: ContributionToScience[] | undefined,
    fallbackContent: string,
    placeholder: string
  ) => {
    if (contributions && contributions.length) {
      return contributions
        .map((contribution, idx) => {
          const products = contribution.products || [];
          const productsMd = products.length
            ? products.map((pub) => `- ${formatCitation(pub)}`).join("\n")
            : "";
          return [`${idx + 1}. ${contribution.description}`, productsMd]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n");
    }
    return fallbackContent.trim() ? fallbackContent : `*${placeholder}*`;
  };

  const renderSupplementContributionsMarkdown = (
    contributions: ContributionToScience[] | undefined,
    fallbackContent: string,
    placeholder: string
  ) => {
    if (contributions && contributions.length) {
      return contributions
        .map((contribution, idx) => {
          const products = contribution.products || [];
          const productsMd = products.length
            ? products.map((pub) => `- ${formatCitation(pub)}`).join("\n")
            : "";
          return [
            `### Contribution ${idx + 1}`,
            contribution.description,
            productsMd,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n");
    }
    return fallbackContent.trim() ? fallbackContent : `*${placeholder}*`;
  };

  const getSectionContent = (id: string) => {
    const matches = sectionById.get(id);
    if (!matches || matches.length === 0) {
      return "";
    }
    return matches.map((match) => match.content).join("\n\n").trim();
  };

  const getSectionContentByHeading = (heading: string) => {
    const target = heading.trim().toLowerCase();
    const match = sections.find(
      (section) =>
        section.canonicalHeading.toLowerCase() === target ||
        section.originalHeading.toLowerCase() === target ||
        section.originalHeading.toLowerCase().includes(target)
    );
    return match ? match.content.trim() : "";
  };

  const getLlmHonors = () => {
    if (!llmStructuredData || typeof llmStructuredData !== "object") {
      return [];
    }
    const supplement = (llmStructuredData as { supplement?: unknown }).supplement;
    if (!supplement || typeof supplement !== "object") {
      return [];
    }
    const honors = (supplement as { honors?: unknown }).honors;
    if (!Array.isArray(honors)) {
      return [];
    }
    return honors
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const year = String((item as { year?: unknown }).year ?? "").trim();
        const honor = String((item as { honor_name?: unknown }).honor_name ?? "").trim();
        if (!year && !honor) {
          return null;
        }
        return { year, honor };
      })
      .filter((item): item is { year: string; honor: string } => Boolean(item));
  };

  const splitInlineSection = (content: string, heading: string) => {
    if (!content.trim()) {
      return { main: content, extracted: "" };
    }
    const lines = content.split(/\r?\n/);
    const normalizedHeading = heading.trim().toLowerCase();
    const headingIndex = lines.findIndex(
      (line) => line.trim().toLowerCase() === normalizedHeading
    );
    if (headingIndex === -1) {
      return { main: content, extracted: "" };
    }
    const stopRegex =
      /^(personal statement|contribution(s)? to science|products|appointments and positions|professional preparation|certification|honors)\b/i;
    let endIndex = lines.length;
    for (let i = headingIndex + 1; i < lines.length; i += 1) {
      if (stopRegex.test(lines[i].trim())) {
        endIndex = i;
        break;
      }
    }
    const main = lines.slice(0, headingIndex).join("\n").trim();
    const extracted = lines
      .slice(headingIndex + 1, endIndex)
      .join("\n")
      .trim();
    return { main, extracted };
  };

  const normalizeCertificationText = (content: string, exactText?: string) => {
    const trimmed = content.trim();
    if (!trimmed && exactText) {
      return exactText;
    }
    if (exactText && trimmed.includes(exactText)) {
      return exactText;
    }
    if (!trimmed) {
      return "";
    }

    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter(
        (line) =>
          !/^certified by\b/i.test(line) &&
          !/^nih biographical sketch\b/i.test(line) &&
          !/^omb no\./i.test(line)
      );

    const normalized = lines.join("\n");
    const coreSentence =
      "I certify that the information provided is current, accurate, and complete.";
    const firstIndex = normalized.indexOf(coreSentence);
    if (firstIndex !== -1) {
      const secondIndex = normalized.indexOf(
        coreSentence,
        firstIndex + coreSentence.length
      );
      if (secondIndex !== -1) {
        return normalized.slice(firstIndex, secondIndex).trim();
      }
    }

    const parts = normalized
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const uniqueParts: string[] = [];
    for (const part of parts) {
      if (seen.has(part)) {
        continue;
      }
      seen.add(part);
      uniqueParts.push(part);
    }
    return uniqueParts.join("\n\n");
  };

  const extractHeaderInfo = () => {
    const headerContent =
      getSectionContent("nih_biosketch_form") ||
      getSectionContent("nih_biosketch_supplement");
    if (!headerContent) {
      return {
        name: "",
        pid: "",
        positionTitle: "",
        organization: "",
      };
    }
    const lines = headerContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const getValue = (label: RegExp) => {
      const line = lines.find((item) => label.test(item));
      if (!line) return "";
      const parts = line.split(/[:\-]\s*/);
      return parts.length > 1 ? parts.slice(1).join(": ").trim() : "";
    };

    return {
      name: getValue(/^name\b/i),
      pid: getValue(/^(pid|era commons user name|era commons)\b/i),
      positionTitle: getValue(/^(position title|title)\b/i),
      organization: getValue(/^(organization|organization\/location|location)\b/i),
    };
  };

  const getLlmHeaderInfo = () => {
    if (!llmStructuredData || typeof llmStructuredData !== "object") {
      return null;
    }
    const commonForm = (llmStructuredData as { common_form?: unknown }).common_form;
    if (!commonForm || typeof commonForm !== "object") {
      return null;
    }
    const header = (commonForm as { header?: unknown }).header;
    if (!header || typeof header !== "object") {
      return null;
    }
    const name = String((header as { name?: unknown }).name ?? "").trim();
    const pid = String((header as { pid_orcid?: unknown }).pid_orcid ?? "").trim();
    const positionTitle = String(
      (header as { position_title?: unknown }).position_title ?? ""
    ).trim();
    const organization = String(
      (header as { organization_location?: unknown }).organization_location ?? ""
    ).trim();
    if (!name && !pid && !positionTitle && !organization) {
      return null;
    }
    return { name, pid, positionTitle, organization };
  };

  const parseAppointments = (content: string) => {
    if (!content.trim()) {
      return [];
    }
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^(\d+[\).]|[-*])\s+/, ""));

    const yearRangeRegex = /(\d{4})\s*-\s*(\d{4}|Present|Current)/i;
    const entries: string[] = [];
    let current = "";

    for (const line of lines) {
      if (yearRangeRegex.test(line) && current) {
        entries.push(current.trim());
        current = line;
        continue;
      }
      current = current ? `${current} ${line}` : line;
    }
    if (current) {
      entries.push(current.trim());
    }

    const parsed = entries.map((entry, index) => {
      const match = entry.match(yearRangeRegex);
      const startYear = match?.[1] ?? "";
      const endYear = match?.[2] ?? "";
      const rest = match ? entry.replace(match[0], "").trim() : entry;
      return {
        startYear,
        endYear,
        rest,
        index,
      };
    });

    parsed.sort((a, b) => {
      const aEnd =
        a.endYear.toLowerCase() === "present" ||
        a.endYear.toLowerCase() === "current"
          ? 9999
          : Number(a.endYear || 0);
      const bEnd =
        b.endYear.toLowerCase() === "present" ||
        b.endYear.toLowerCase() === "current"
          ? 9999
          : Number(b.endYear || 0);
      if (aEnd !== bEnd) return bEnd - aEnd;
      const aStart = Number(a.startYear || 0);
      const bStart = Number(b.startYear || 0);
      if (aStart !== bStart) return bStart - aStart;
      return a.index - b.index;
    });

    return parsed.map((item) => {
      if (!item.startYear || !item.endYear) {
        return { timeframe: "", position: item.rest };
      }
      return {
        timeframe: `${item.startYear} - ${item.endYear}`,
        position: item.rest,
      };
    });
  };

  const parseHonors = (content: string) => {
    if (!content.trim()) {
      return [];
    }
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^(\d+[\).]|[-*])\s+/, ""));
    const entries: { year: string; honor: string }[] = [];
    let currentYear = "";
    let currentHonor = "";

    const flush = () => {
      if (currentYear || currentHonor) {
        entries.push({
          year: currentYear.trim(),
          honor: currentHonor.trim(),
        });
      }
      currentYear = "";
      currentHonor = "";
    };

    for (const line of lines) {
      const yearMatch = line.match(/^(\d{4})\b\s*(.*)$/);
      if (yearMatch) {
        flush();
        currentYear = yearMatch[1];
        currentHonor = yearMatch[2].trim();
        continue;
      }
      if (!currentYear && /^\d{4}$/.test(line)) {
        flush();
        currentYear = line;
        continue;
      }
      currentHonor = currentHonor ? `${currentHonor} ${line}` : line;
    }
    flush();

    return entries.filter((entry) => entry.year || entry.honor);
  };

  

  
  const certificationRule = allSections.find(
    (section) => section.id === "certification_statement"
  );
  const headerInfo = getLlmHeaderInfo() ?? extractHeaderInfo();

  const headerValue = (value: string, placeholder: string) =>
    value.trim() ? value : placeholder;

  const headerListHtml = `<div class="header-list">
    <div>Name: ${escapeHtml(headerValue(headerInfo.name, "[Name]"))}</div>
    <div>PID (ORCID): ${escapeHtml(headerValue(headerInfo.pid, "[PID]"))}</div>
    <div>Position Title: ${escapeHtml(
      headerValue(headerInfo.positionTitle, "[Position Title]")
    )}</div>
    <div>Organization/Location: ${escapeHtml(
      headerValue(headerInfo.organization, "[Organization/Location]")
    )}</div>
  </div>`;

  const commonHeaderHtml = `<div class="header">
    ${headerListHtml}
    <div class="omb">OMB No. 3145-0279<br />Expiration Date: [MM/DD/YYYY]</div>
  </div>`;

  const supplementHeaderHtml = `<div class="header">
    ${headerListHtml}
    <div class="omb">OMB No. 0925-0001<br />Expiration Date: [MM/DD/YYYY]</div>
  </div>`;

  const addSection = (
    target: string[],
    title: string,
    html: string,
    markdown: string
  ) => {
    const label = `[COPY INTO SCIENCV: ${title.toUpperCase()}]`;
    target.push(
      `<div class="section"><div class="instruction-label">${escapeHtml(
        label
      )}</div><h2>${escapeHtml(title)}</h2>${html}</div>`
    );
    markdownParts.push(`*${label}*\n\n## ${title}\n\n${markdown}\n`);
  };

  commonFormParts.push("<h1>NIH BIOGRAPHICAL SKETCH COMMON FORM</h1>");
  commonFormParts.push(commonHeaderHtml);

  supplementParts.push("<h1>NIH BIOGRAPHICAL SKETCH SUPPLEMENT</h1>");
  supplementParts.push(supplementHeaderHtml);

  markdownParts.push(
    [
      `Name: ${headerValue(headerInfo.name, "[Name]")}`,
    `PID (ORCID): ${headerValue(headerInfo.pid, "[PID]")}`,
      `Position Title: ${headerValue(headerInfo.positionTitle, "[Position Title]")}`,
      `Organization/Location: ${headerValue(
        headerInfo.organization,
        "[Organization/Location]"
      )}`,
      "",
    ].join("\n")
  );

  const professionalContent = getSectionContent("professional_preparation");
  addSection(
    commonFormParts,
    "Professional Preparation",
    renderProfessionalPreparationHtml(
      biosketchData.professionalPreparation,
      professionalContent,
      "TODO: Add Professional Preparation"
    ),
    renderProfessionalPreparationMarkdown(
      biosketchData.professionalPreparation,
      professionalContent,
      "TODO: Add Professional Preparation"
    )
  );

  const appointmentsContent = getSectionContent("appointments_and_positions");
  const appointmentsList = parseAppointments(appointmentsContent);
  const appointmentsHtml = appointmentsList.length
    ? `<table class="appointments-table"><tbody>${appointmentsList
        .map(
          (item) => `<tr><td class="timeframe">${escapeHtml(
            item.timeframe
          )}</td><td>${escapeHtml(item.position)}</td></tr>`
        )
        .join("")}</tbody></table>`
    : escapeOrPlaceholder(appointmentsContent, "TODO: Add Appointments and Positions");
  const appointmentsMarkdown = appointmentsList.length
    ? appointmentsList
        .map((item) => `${item.timeframe}  ${item.position}`.trim())
        .join("\n")
    : appointmentsContent || "*TODO: Add Appointments and Positions*";
  addSection(
    commonFormParts,
    "Appointments and Positions",
    appointmentsHtml,
    appointmentsMarkdown
  );

  const productsRelatedContent = getSectionContent("products_related_to_project");
  const otherProductsContent = getSectionContent("other_significant_products");
  const productsHtml = `<h3>Products Closely Related to the Proposed Project</h3>
    ${renderPublicationListHtml(
      biosketchData.products_related_to_project,
      productsRelatedContent,
      "TODO: Add Products Closely Related to the Proposed Project"
    )}
    <h3>Other Significant Products</h3>
    ${renderPublicationListHtml(
      biosketchData.other_significant_products,
      otherProductsContent,
      "TODO: Add Other Significant Products"
    )}`;
  const productsMarkdown = [
    "### Products Closely Related to the Proposed Project",
    renderPublicationListMarkdown(
      biosketchData.products_related_to_project,
      productsRelatedContent,
      "TODO: Add Products Closely Related to the Proposed Project"
    ),
    "",
    "### Other Significant Products",
    renderPublicationListMarkdown(
      biosketchData.other_significant_products,
      otherProductsContent,
      "TODO: Add Other Significant Products"
    ),
  ].join("\n");
  addSection(commonFormParts, "Products", productsHtml, productsMarkdown);

  const rawCertification = getSectionContent("certification_statement");
  const certificationText = normalizeCertificationText(
    rawCertification,
    certificationRule?.exactText
  );
  const signatureName = headerInfo.name.trim()
    ? headerInfo.name
    : "[Name]";
  const signatureDate = "[Date]";
  const certificationHtml = `${escapeOrPlaceholder(
    certificationText,
    "TODO: Add Certification"
  )}<div class="cert-footer">Certified by ${escapeHtml(
    signatureName
  )} in SciENcv on ${escapeHtml(signatureDate)}</div>`;
  const certificationMarkdown = [
    certificationText || "*TODO: Add Certification*",
    "",
    `Certified by ${signatureName} in SciENcv on ${signatureDate}`,
  ].join("\n");
  addSection(commonFormParts, "Certification", certificationHtml, certificationMarkdown);

  let personalStatementContent = getSectionContent("personal_statement");
  const inlineHonors = splitInlineSection(personalStatementContent, "Honors");
  personalStatementContent = inlineHonors.main || personalStatementContent;
  const normalizedPersonalStatement = personalStatementContent
    .replace(/\s+/g, " ")
    .trim();
  addSection(
    supplementParts,
    "Personal Statement",
    escapeOrPlaceholder(
      normalizedPersonalStatement,
      "TODO: Add Personal Statement"
    ),
    normalizedPersonalStatement || "*TODO: Add Personal Statement*"
  );

  let honorsContent = getSectionContentByHeading("honors");
  if (!honorsContent) {
    honorsContent = getSectionContentByHeading("awards");
  }
  if (!honorsContent && inlineHonors.extracted) {
    honorsContent = inlineHonors.extracted;
  }
  const honorsList = parseHonors(honorsContent);
  const llmHonors = getLlmHonors();
  const honorsHtml = honorsList.length
    ? `<ol>${honorsList
      .map((item) =>
        `<li>${escapeHtml(item.year)}${item.year ? " - " : ""}${escapeHtml(
          item.honor
        )}</li>`
      )
      .join("")}</ol>`
    : llmHonors.length
    ? `<ol>${llmHonors
      .map((item) =>
        `<li>${escapeHtml(item.year)}${item.year ? " - " : ""}${escapeHtml(
          item.honor
        )}</li>`
      )
      .join("")}</ol>`
    : escapeOrPlaceholder(honorsContent, "TODO: Add Honors");
  const honorsMarkdown = honorsList.length
    ? honorsList
      .map(
        (item) => `${item.year}${item.year ? " - " : ""}${item.honor}`.trim()
      )
      .join("\n")
    : llmHonors.length
    ? llmHonors
      .map(
        (item) => `${item.year}${item.year ? " - " : ""}${item.honor}`.trim()
      )
      .join("\n")
    : honorsContent || "*TODO: Add Honors*";
  addSection(supplementParts, "Honors", honorsHtml, honorsMarkdown);

  const contributionsContent = getSectionContent("contributions_to_science");
  addSection(
    supplementParts,
    "Contributions to Science",
    renderSupplementContributionsHtml(
      biosketchData.contributionsToScience,
      contributionsContent,
      "TODO: Add Contributions to Science"
    ),
    renderSupplementContributionsMarkdown(
      biosketchData.contributionsToScience,
      contributionsContent,
      "TODO: Add Contributions to Science"
    )
  );

  addSection(
    supplementParts,
    "Certification",
    certificationHtml,
    certificationMarkdown
  );

  htmlParts.push(`<div id="common-form">${commonFormParts.join("")}</div>`);
  htmlParts.push(`<div id="supplement">${supplementParts.join("")}</div>`);

  return {
    markdown: markdownParts.join("\n"),
    html: `${css}<div class="nih-biosketch">${htmlParts.join("")}</div>`,
  };
}
