import { PDFParse } from "pdf-parse";

import { ParseResult } from "@/lib/types";

export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const parser = new PDFParse({ data: buffer });
  const data = await parser.getText();
  await parser.destroy();

  return {
    text: data.text || "",
    lowConfidence: true,
  };
}
