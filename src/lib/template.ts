import { readFile } from "node:fs/promises";
import path from "node:path";

import { TemplateConfig } from "@/lib/types";

let cachedTemplate: TemplateConfig | null = null;

export async function loadTemplate(): Promise<TemplateConfig> {
  if (cachedTemplate) {
    return cachedTemplate;
  }

  const templatePath = path.join(
    process.cwd(),
    "config",
    "nih-biosketch-template-2026.json"
  );
  const raw = await readFile(templatePath, "utf-8");
  cachedTemplate = JSON.parse(raw) as TemplateConfig;
  return cachedTemplate;
}
