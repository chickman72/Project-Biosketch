import { NextResponse } from "next/server";

import { processBiosketchFile } from "@/lib/processBiosketch";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

const rateLimitStore = new Map<string, { count: number; start: number }>();

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return "local";
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, start: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function POST(request: Request) {
  const clientKey = getClientKey(request);
  if (!checkRateLimit(clientKey)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File too large. Max size is 20MB." },
      { status: 400 }
    );
  }

  const fileType = file.type || "";
  const fileName = file.name.toLowerCase();
  const isDocx =
    fileType.includes("wordprocessingml") || fileName.endsWith(".docx");
  const isPdf = fileType.includes("pdf") || fileName.endsWith(".pdf");
  if (!isPdf && !isDocx) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a .docx or .pdf." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const result = await processBiosketchFile(
      buffer,
      isDocx ? "wordprocessingml" : "pdf"
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Processing failed." },
      { status: 500 }
    );
  }
}
