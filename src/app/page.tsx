"use client";

import { useMemo, useState } from "react";
import htmlDocx from "html-docx-js/dist/html-docx";

import { Publication, ValidationResult } from "@/lib/types";
import { formatCitation } from "@/lib/publications";

type TabKey = "status" | "findings" | "publications";

const tabLabels: Record<TabKey, string> = {
  status: "Status",
  findings: "Findings",
  publications: "Publications",
};

function statusStyles(status: string) {
  if (status === "red") {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (status === "yellow") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function publicationsToCsv(publications: Publication[]) {
  const header = ["Authors", "Title", "Journal", "Year", "PMID/PMCID"];
  const rows = publications.map((pub) => {
    const values = [
      pub.authors,
      pub.title,
      pub.journal_or_source ?? "",
      pub.year ?? "",
      pub.doi_or_pmid ?? "",
    ];
    return values
      .map((value) => {
        const str = String(value ?? "").replace(/\r?\n/g, " ");
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<ValidationResult | null>(null);
  const [tab, setTab] = useState<TabKey>("status");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const formattedCitations = useMemo(() => {
    if (!results) return [];
    return results.publications.map((pub) => formatCitation(pub));
  }, [results]);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }
      setResults(data as ValidationResult);
      setTab("status");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setFile(null);
    setResults(null);
    setError(null);
    setTab("status");
  }

  async function handleDownloadCorrectedDocx() {
    if (!results) return;
    const docxHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <style>
        #supplement { page-break-before: auto !important; break-before: auto !important; }
      </style>
      </head><body>${results.correctedDraftHtml.replace(
        '<div id="supplement">',
        '<br style="page-break-before: always;" /><div id="supplement">'
      )}</body></html>`;
    const docxBlob = htmlDocx.asBlob(docxHtml);
    downloadBlob("biosketch-corrected-draft.docx", docxBlob);
  }

  function handleExportPublications() {
    if (!results) return;
    downloadFile(
      "biosketch-publications.json",
      JSON.stringify(results.publications, null, 2),
      "application/json"
    );
    downloadFile(
      "biosketch-publications.csv",
      publicationsToCsv(results.publications),
      "text/csv"
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-14">
        <header className="flex flex-col gap-4">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
            SciENcv Migration Assistant
          </p>
          <h1 className="text-4xl font-semibold text-slate-50 md:text-5xl">
            NIH Biosketch Migration Assistant
          </h1>
          <p className="max-w-3xl text-base text-slate-300 md:text-lg">
            Upload your existing CV or Biosketch to validate against 2026 Common
            Form rules and generate SciENcv-ready text blocks.
          </p>
        </header>

        <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-8 md:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Upload</h2>
            <p className="text-sm text-slate-400">
              Drag and drop a .docx or .pdf file (PDF is best-effort).
              Files are processed transiently and not stored.
            </p>
            <label
              className={`flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-slate-950/40 text-sm text-slate-300 transition ${
                isDragging
                  ? "border-emerald-400 bg-emerald-400/10 text-emerald-100"
                  : "border-slate-700 hover:border-slate-500"
              }`}
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const dropped = event.dataTransfer?.files?.[0] ?? null;
                if (dropped) {
                  setFile(dropped);
                }
                setIsDragging(false);
              }}
            >
              <input
                type="file"
                accept=".docx,.pdf"
                className="hidden"
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
              />
              <span className="text-base font-medium">
                {file ? file.name : "Select or drop a file"}
              </span>
              <span className="text-xs text-slate-500">
                Max file size 20MB
              </span>
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={!file || loading}
                onClick={handleUpload}
              >
                {loading ? "Processing..." : "Analyze Biosketch"}
              </button>
              {results && (
                <>
                  <button
                    className="rounded-full border border-slate-600 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                    onClick={handleDownloadCorrectedDocx}
                  >
                    Download Corrected Draft (.docx)
                  </button>
                  <button
                    className="rounded-full border border-slate-600 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                    onClick={handleClear}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Processing notes
            </h3>
            <ul className="space-y-3 text-sm text-slate-300">
              <li>Rule-based validation against configurable NIH template.</li>
              <li>Best-effort PDF parsing (lower confidence).</li>
              <li>Outputs are sanitized and safe to copy/share.</li>
              <li>Optional Azure OpenAI hook is disabled by default.</li>
            </ul>
          </div>
        </section>

        {results && (
          <section className="flex flex-col gap-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full border px-4 py-1 text-xs font-semibold uppercase ${statusStyles(
                    results.overallStatus
                  )}`}
                >
                  {results.overallStatus}
                </span>
                {results.lowConfidence && (
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
                    Low confidence (PDF)
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-400">
                {results.issues.length} findings •{" "}
                {results.publications.length} publications
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {Object.entries(tabLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key as TabKey)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    tab === key
                      ? "border-emerald-400 bg-emerald-400/10 text-emerald-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "status" && (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Validation checklist
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-200">
                    <li>✅ PII Check (No home address/phone detected)</li>
                    <li>✅ Personal Statement Length (&lt; 3,500 chars)</li>
                    <li>✅ Contribution to Science Count (Max 5 items)</li>
                    <li>✅ Contribution Length (&lt; 2,000 chars each)</li>
                    <li>
                      ✅ Product Formatting (Split into "Related" &
                      "Significant")
                    </li>
                  </ul>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                    <p className="text-sm text-slate-400">Required sections</p>
                    <p className="text-2xl font-semibold text-slate-50">
                      {results.detectedSections.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                    <p className="text-sm text-slate-400">Red findings</p>
                    <p className="text-2xl font-semibold text-slate-50">
                      {results.issues.filter((issue) => issue.severity === "red")
                        .length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                    <p className="text-sm text-slate-400">Yellow findings</p>
                    <p className="text-2xl font-semibold text-slate-50">
                      {
                        results.issues.filter(
                          (issue) => issue.severity === "yellow"
                        ).length
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {tab === "findings" && (
              <div className="flex flex-col gap-3">
                {results.issues.map((issue, index) => (
                  <div
                    key={`${issue.id}-${issue.section ?? "general"}-${index}`}
                    className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusStyles(
                          issue.severity
                        )}`}
                      >
                        {issue.severity}
                      </span>
                      <h4 className="text-base font-semibold text-slate-100">
                        {issue.title}
                      </h4>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      {issue.description}
                    </p>
                    {issue.evidenceSnippet && (
                      <p className="mt-2 text-xs text-slate-500">
                        Evidence: {issue.evidenceSnippet}
                      </p>
                    )}
                    {issue.recommendation && (
                      <p className="mt-2 text-xs text-slate-400">
                        Recommendation: {issue.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === "publications" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-full border border-slate-600 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        formattedCitations.join("\n")
                      )
                    }
                  >
                    Copy citations
                  </button>
                  <button
                    className="rounded-full border border-slate-600 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                    onClick={handleExportPublications}
                  >
                    Export Publications
                  </button>
                </div>
                <div className="grid gap-3">
                  {formattedCitations.length === 0 && (
                    <p className="text-sm text-slate-400">
                      No publications detected yet.
                    </p>
                  )}
                  {formattedCitations.map((citation, index) => (
                    <div
                      key={`${citation}-${index}`}
                      className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
                    >
                      {citation}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {results && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-8">
            <h2 className="text-xl font-semibold text-slate-100">
              Corrected draft preview
            </h2>
            <div
              className="corrected-preview mt-4 max-w-none text-slate-100"
              dangerouslySetInnerHTML={{
                __html: results.correctedDraftHtml,
              }}
            />
          </section>
        )}
      </div>
    </div>
  );
}
