# TI4 Quick Guide

A fast, mobile-friendly, unofficial rules reference for the base game of
*Twilight Imperium: Fourth Edition*. It presents the complete numbered glossary
from Fantasy Flight Games' official Rules Reference as searchable, linkable
local data.

This project uses vanilla TypeScript, semantic HTML, CSS, and Vite. It has no
backend, runtime API, analytics, externally hosted art, or runtime PDF parsing.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Deploy to a one.com subdomain (PHP 8.3)

The production site has no server-side framework and needs no Node.js on the
web host. `npm run build` creates a self-contained `dist/` directory containing
an `index.php`, a fallback `index.html`, and fingerprinted local assets. Asset
URLs are relative, so no hostname or subdomain needs to be configured in code.
The generated `index.html` can also be opened directly from the filesystem for
a quick offline preview.

1. Run `npm install` and `npm run build` on your own computer.
2. In the one.com control panel, create or select the subdomain.
3. Open File Manager or connect by SFTP.
4. Upload **the contents of `dist/`** to that subdomain's document root.
5. Confirm that `index.php` is served as the directory index.

No database, environment variables, cron job, rewrite rules, API keys, or PHP
extensions are required. PHP 8.3 simply serves the generated page; all search
and navigation behavior runs in the browser.

## Commands

```sh
npm run dev          # development server
npm run build        # type-check and production build
npm run lint         # strict TypeScript check
npm test             # data and link tests
npm run validate     # validate data and write validation-report.json
npm run import:rules # regenerate src/data/rules.json from the local PDF
```

The importer additionally requires Python 3 and `pdfplumber`:

```sh
python3 -m pip install pdfplumber
```

## Project structure

- `docs/ti-k0289_rules_referencecompressed.pdf` — immutable source document
- `scripts/import_rules.py` — deterministic two-column PDF glossary importer
- `scripts/validate-data.js` — integrity checks and validation report generator
- `src/data/rules.json` — reviewed, local structured rule data
- `src/main.ts` — rendering, search, history, deep links, and theme behavior
- `src/styles.css` — responsive, accessible visual system
- `tests/data.test.js` — source completeness and link integrity tests

## Extraction and updates

The importer reads printed glossary pages 4–29 using the PDF's embedded text
layer; it does not use OCR. Each page is cropped into its two reading-order
columns. The importer recognizes all 89 sequential topic headings, paragraph
identifiers, subsection markers, bullets, related-topic lists, and printed
source pages. The expected source title sequence acts as an omission guard.
The PDF index was used as a secondary manual check for topic coverage and common
aliases.

To update from a newer official base-game document:

1. Replace the PDF in `docs/` (or update `PDF` in the importer).
2. Review the glossary page range, document metadata, and `EXPECTED` titles.
3. Run `npm run import:rules`.
4. Review the generated diff, especially headings, bullets, and warnings.
5. Run `npm run validate && npm test && npm run build`.

The import date is deterministic for a given day. The checked-in JSON is what
the application loads.

## Known limitations

- Index aliases are intentionally conservative; the full printed index is not
  reproduced.
- Rules on cards, faction sheets, and the Learn to Play booklet are outside the
  glossary's scope.
- This source is the 2017 base-game reference (TI-K0289). It deliberately does
  not include Prophecy of Kings, later expansions, community rulings, errata
  from newer documents, or other editions.

## Attribution and non-affiliation

Rule text is sourced from the official *Twilight Imperium: Fourth Edition Rules
Reference*, copyright Fantasy Flight Games / Asmodee. Twilight Imperium and
related marks are the property of their respective owners.

This is an unofficial, fan-made aid. It is not affiliated with, authorized by,
or endorsed by Fantasy Flight Games or Asmodee. No official logos or artwork are
used. The rule text is included only to provide a functional table reference.
