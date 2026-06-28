import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../src/data/rules.json", import.meta.url), "utf8"));

test("contains the complete numbered base-game glossary", () => {
  assert.equal(data.entries.length, 89);
  assert.deepEqual(data.entries.map(entry => Number(entry.number)), Array.from({ length: 89 }, (_, i) => i + 1));
});

test("all slugs and paragraph identifiers are unique", () => {
  const slugs = data.entries.map(entry => entry.slug);
  const ids = data.entries.flatMap(entry => entry.sections.map(section => section.id));
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(new Set(ids).size, ids.length);
});

test("related topics and source pages resolve", () => {
  const slugs = new Set(data.entries.map(entry => entry.slug));
  for (const entry of data.entries) {
    assert.ok(entry.sourcePages.every(page => page >= 4 && page <= 29));
    for (const related of entry.relatedTopics) assert.ok(slugs.has(related.slug), `${entry.title} -> ${related.title}`);
  }
});

test("known deep links are represented", () => {
  const ids = new Set(data.entries.flatMap(entry => entry.sections.map(section => section.id)));
  assert.ok(data.entries.some(entry => entry.slug === "space-combat"));
  assert.ok(ids.has("38.2"));
  assert.ok(ids.has("18.1"));
});

test("illustration text does not leak into command token rule 19.4", () => {
  const commandTokens = data.entries.find(entry => entry.number === "19");
  const rule = commandTokens.sections.find(section => section.id === "19.4");
  assert.equal(
    rule.content,
    "During the action phase, a player can perform a tactical action by spending a command token from his tactic pool; he places the command token in a system."
  );
});
