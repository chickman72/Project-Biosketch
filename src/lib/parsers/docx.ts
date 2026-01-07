import mammoth from "mammoth";

import { ParseResult } from "@/lib/types";

export async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const { value } = await mammoth.extractRawText({ buffer });
  return {
    text: value || "",
    lowConfidence: false,
  };
}
