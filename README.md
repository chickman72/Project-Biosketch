# Biosketch & Grant Package QA Copilot (MVP)

Validate NIH biosketch structure, flag formatting issues, extract publications, and generate a corrected draft. This MVP is local-first with no user accounts and no persistent storage.

## Setup

```bash
npm install
```

## Local Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## How The Validator Works

- Loads the NIH template definition from `config/nih-biosketch-template.json`.
- Detects section headings by matching normalized heading variants.
- Flags:
  - Missing required sections (Red)
  - Out-of-order sections (Yellow)
  - Duplicate headings (Yellow)
  - Suspiciously short sections (Yellow)
  - Unknown headings (Yellow)

## Template Format

`config/nih-biosketch-template.json` defines:

- `requiredSections`: canonical headings, allowed variants, min length
- `optionalSections`: additional supported headings
- `order`: expected section order
- `unknownHeadingHeuristic`: constraints for headings that do not match

## Publication Extraction (MVP)

- Extracts publication-like entries from:
  - `Contributions to Science`
  - `Publications` (if present)
- Normalizes entries into JSON fields: authors, year, title, journal/source, DOI/PMID
- Exports CSV + JSON and renders a basic Vancouver-ish list

## Corrected Draft (MVP)

- Normalizes headings to canonical template headings
- Inserts placeholders for missing required sections
- Reorders sections into template order (when detected)
- Renders HTML preview and downloads `.md` + `.html`

## Privacy

Files are processed transiently and not stored. Processing happens server-side in memory.

## Environment Variables (Optional)

Azure OpenAI integration is stubbed and **OFF by default**.

If you enable it, set:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`

Data sent externally should be audited before enabling.

## Azure Deployment

See `docs/azure-app-service.md`.

## Tests

```bash
npm run test
```

## Samples

See `samples/sample-biosketch.txt` for a synthetic biosketch example.
