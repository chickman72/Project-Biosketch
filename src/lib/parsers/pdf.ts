import pdfParse from "pdf-parse";

import { ParseResult } from "@/lib/types";

export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer);
  return {
    text: data.text || "",
    lowConfidence: true,
  };
}
