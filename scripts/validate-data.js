#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(resolve(root, "src/data/rules.json"), "utf8"));
const errors = [];
const warnings = [...(data.extractionWarnings ?? [])];
const duplicates = (items) => [...new Set(items.filter((item, i) => items.indexOf(item) !== i))];
const slugs = data.entries.map(entry => entry.slug);
const ids = data.entries.flatMap(entry => entry.sections.map(section => section.id));
const slugSet = new Set(slugs);
const idSet = new Set(ids);

if (data.entries.length !== 89) errors.push(`Expected 89 topics, found ${data.entries.length}`);
const numbers = data.entries.map(entry => Number(entry.number));
if (!numbers.every((number, index) => number === index + 1)) errors.push("Topic numbering is not the complete 1–89 source sequence");
if (duplicates(slugs).length) errors.push(`Duplicate slugs: ${duplicates(slugs).join(", ")}`);
if (duplicates(ids).length) errors.push(`Duplicate paragraph IDs: ${duplicates(ids).join(", ")}`);

for (const entry of data.entries) {
  if (!entry.title || !entry.slug || !entry.introduction) errors.push(`Incomplete topic: ${entry.number}`);
  if (entry.sourcePages.some(page => !Number.isInteger(page) || page < 4 || page > 29)) {
    errors.push(`Invalid source page for ${entry.title}`);
  }
  for (const section of entry.sections) {
    if (!new RegExp(`^${entry.number}\\.\\d+$`).test(section.id)) {
      errors.push(`Paragraph ${section.id} does not belong to topic ${entry.number}`);
    }
  }
  for (const related of entry.relatedTopics) {
    if (!slugSet.has(related.slug)) errors.push(`Unresolved related topic: ${entry.title} -> ${related.title}`);
  }
  for (const alias of entry.aliases) {
    if (typeof alias !== "string" || !alias.trim()) errors.push(`Invalid alias on ${entry.title}`);
  }
}

const sorted = [...data.entries].sort((a, b) => a.title.localeCompare(b.title));
if (sorted.length !== data.entries.length || sorted.some(entry => !slugSet.has(entry.slug))) {
  errors.push("Topics cannot be alphabetically sorted");
}
if (!data.meta?.sourceUrl || !Array.isArray(data.entries)) errors.push("Generated data cannot be loaded by the application");

const report = {
  generatedAt: new Date().toISOString(),
  topLevelTopics: data.entries.length,
  ruleParagraphs: ids.length,
  unresolvedCrossReferences: errors.filter(error => error.startsWith("Unresolved")),
  duplicateSlugs: duplicates(slugs),
  duplicateParagraphIds: duplicates(ids),
  parsingWarnings: warnings,
  status: errors.length ? "failed" : "passed"
};
writeFileSync(resolve(root, "validation-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (errors.length) {
  console.error("\nValidation errors:\n- " + errors.join("\n- "));
  process.exit(1);
}
