#!/usr/bin/env python3
"""Extract the TI4 base-game glossary from the official Rules Reference PDF.

Requires pdfplumber. Run from the repository root:
  python3 scripts/import_rules.py
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    sys.exit("pdfplumber is required: python3 -m pip install pdfplumber")

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "docs" / "ti-k0289_rules_referencecompressed.pdf"
OUTPUT = ROOT / "src" / "data" / "rules.json"

EXPECTED = [
    "Abilities", "Action Cards", "Action Phase", "Active Player", "Active System",
    "Adjacency", "Agenda Card", "Agenda Phase", "Anomalies", "Anti-Fighter Barrage",
    "Asteroid Field", "Attach", "Attacker", "Blockaded", "Bombardment", "Capacity",
    "Combat", "Command Sheet", "Command Tokens", "Commodities", "Component Action",
    "Component Limitations", "Construction", "Control", "Cost", "Custodians Token",
    "Deals", "Defender", "Destroyed", "Diplomacy", "Elimination", "Exhausted",
    "Fighter Tokens", "Fleet Pool", "Game Board", "Game Round", "Gravity Rift",
    "Ground Combat", "Ground Forces", "Imperial", "Infantry Tokens", "Influence",
    "Initiative Order", "Invasion", "Leadership", "Mecatol Rex", "Modifiers", "Move",
    "Movement", "Nebula", "Neighbors", "Objective Cards", "Opponent", "PDS", "Planets",
    "Planetary Shield", "Politics", "Producing Units", "Production", "Promissory Notes",
    "Readied", "Reinforcements", "Rerolls", "Resources", "Ships", "Space Cannon",
    "Space Combat", "Space Dock", "Speaker", "Status Phase", "Strategic Action",
    "Strategy Card", "Strategy Phase", "Structures", "Supernova", "Sustain Damage",
    "System Tiles", "Tactical Action", "Technology", "Technology", "Trade",
    "Trade Goods", "Transactions", "Transport", "Units", "Unit Upgrades",
    "Victory Points", "Warfare", "Wormholes"
]

TOPIC_RE = re.compile(r"^(\d{1,2})(?: \((?:UNIT ABILITY|ATTRIBUTE|STRATEGY CARD)\))?$")
RULE_RE = re.compile(r"^(\d{1,2}\.\d{1,2})\s*(.*)$")
UPPER_RE = re.compile(r"^[A-Z][A-Z0-9 —–'“”:-]+$")

def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")

def clean(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip()).replace("STEP 2:—", "STEP 2—")

def join(parts: list[str]) -> str:
    text = " ".join(x for x in parts if x).strip()
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    return text

def extract_lines() -> list[dict]:
    result = []
    with pdfplumber.open(PDF) as doc:
        # Printed glossary pages 4–29, PDF pages 4–29 (zero-based 3–28).
        for page_index in range(3, 29):
            page = doc.pages[page_index]
            for column, (x0, x1) in enumerate(((31, 300), (312, 581))):
                text = page.crop((x0, 35, x1, 755)).extract_text(
                    x_tolerance=2, y_tolerance=3
                ) or ""
                for raw in text.splitlines():
                    line = clean(raw)
                    if line and not re.fullmatch(r"\d{1,2}", line):
                        result.append({"page": page_index + 1, "column": column, "text": line})
                    elif line:
                        result.append({"page": page_index + 1, "column": column, "text": line})
    return result

def find_topics(lines: list[dict]) -> list[dict]:
    starts = []
    for i in range(1, len(lines)):
        match = TOPIC_RE.fullmatch(lines[i]["text"])
        if not match:
            continue
        number = int(match.group(1))
        title = re.sub(r"\s+\((?:UNIT ABILITY|ATTRIBUTE|STRATEGY CARD)\)$", "", lines[i - 1]["text"])
        if number == len(starts) + 1 and UPPER_RE.fullmatch(title):
            starts.append({"index": i - 1, "number": number, "title": title.title()})
    if len(starts) != 89:
        raise ValueError(f"Expected 89 topic starts, found {len(starts)}")

    entries = []
    title_counts: dict[str, int] = {}
    for position, start in enumerate(starts):
        end = starts[position + 1]["index"] if position + 1 < len(starts) else len(lines)
        number = start["number"]
        expected_title = EXPECTED[number - 1]
        title_counts[expected_title] = title_counts.get(expected_title, 0) + 1
        slug = slugify(expected_title)
        if title_counts[expected_title] > 1:
            slug += "-strategy-card"
        body = lines[start["index"] + 2:end]
        pages = sorted({item["page"] for item in body} | {lines[start["index"]]["page"]})
        entries.append(parse_entry(str(number), expected_title, slug, pages, body))
    return entries

def parse_entry(number: str, title: str, slug: str, pages: list[int], body: list[dict]) -> dict:
    related_at = next((i for i, item in enumerate(body) if item["text"].startswith("RELATED TOPICS:")), None)
    related_text = ""
    if related_at is not None:
        related_parts = [body[related_at]["text"].removeprefix("RELATED TOPICS:").strip()]
        j = related_at + 1
        while j < len(body) and not RULE_RE.match(body[j]["text"]):
            related_parts.append(body[j]["text"])
            j += 1
        related_text = join(related_parts)
        body = body[:related_at]

    # Illustration text can cause an identifier to land mid-line (18.1 in the
    # command-sheet diagram). Split any such embedded marker before parsing.
    expanded_body = []
    embedded = re.compile(rf"\s+({re.escape(number)}\.\d+)\s+")
    for item in body:
        match = embedded.search(item["text"])
        if match and not item["text"].startswith(match.group(1)):
            prefix = item["text"][:match.start()].strip()
            suffix = item["text"][match.start() + 1:].strip()
            if prefix:
                expanded_body.append({**item, "text": prefix})
            expanded_body.append({**item, "text": suffix})
        else:
            expanded_body.append(item)
    body = expanded_body

    rules = []
    intro_parts: list[str] = []
    current = None
    pending_heading = None

    for item in body:
        text = item["text"]
        rule_match = RULE_RE.match(text)
        if rule_match:
            if current:
                finish_rule(current)
                rules.append(current)
            rid, content = rule_match.groups()
            heading = pending_heading if not content else None
            current = {
                "id": rid, "heading": heading, "contentParts": [content] if content else [],
                "bullets": [], "sourcePage": item["page"]
            }
            pending_heading = None
        elif current is None:
            # Card artwork on Action Cards is deliberately excluded.
            if number != "2" or len(intro_parts) < 2:
                intro_parts.append(text)
        elif text.startswith("•"):
            current["bullets"].append(text[1:].strip())
        elif current["bullets"] and not UPPER_RE.fullmatch(text):
            current["bullets"][-1] += " " + text
        elif UPPER_RE.fullmatch(text) and len(text) < 52:
            pending_heading = text.title()
        else:
            current["contentParts"].append(text)
    if current:
        finish_rule(current)
        rules.append(current)

    # A heading appears immediately before its numbered marker in the PDF.
    for index, rule in enumerate(rules[:-1]):
        if rule["content"] == "" and not rule.get("heading") and index:
            pass

    related_names = [x.strip().rstrip(".") for x in related_text.split(",") if x.strip()]
    # Resolve later with the canonical title map; strip line-wrap artifacts.
    related = [{"title": name, "slug": slugify(name)} for name in related_names]
    return {
        "number": number,
        "title": title,
        "slug": slug,
        "aliases": [],
        "sourcePages": pages,
        "introduction": join(intro_parts).replace(" a TACTIC tactic", " a tactic").replace(" a trade FLEET good", " a trade good"),
        "sections": rules,
        "relatedTopics": related
    }

def finish_rule(rule: dict) -> None:
    rule["content"] = join(rule.pop("contentParts"))
    rule["bullets"] = [join([bullet]) for bullet in rule["bullets"]]
    # The command-sheet illustration overlaps the text layer immediately after
    # 19.4. Discard the decorative labels and vector glyph fragments.
    if rule["id"] == "19.4":
        rule["content"] = rule["content"].split(" TRADE GOODS STRATEGY", 1)[0]
    if rule["content"] and UPPER_RE.fullmatch(rule["content"]) and len(rule["content"]) < 60:
        rule["heading"] = rule["content"].title()
        rule["content"] = ""
    if rule.get("heading") is None:
        rule.pop("heading", None)

def add_aliases(entries: list[dict]) -> None:
    """Add conservative aliases derived from canonical glossary terminology."""
    aliases = {
        "anti-fighter-barrage": ["AFB"],
        "command-tokens": ["tactic pool", "strategy pool"],
        "custodians-token": ["custodians"],
        "ground-forces": ["infantry"],
        "pds": ["planetary defense system"],
        "producing-units": ["produce units"],
        "space-dock": ["dock"],
        "victory-points": ["VP", "victory point"],
    }
    for entry in entries:
        entry["aliases"] = aliases.get(entry["slug"], [])

def resolve_related(entries: list[dict]) -> list[str]:
    title_map = {entry["title"].lower(): entry["slug"] for entry in entries}
    # Ambiguous "Technology" references mean the topic, not its strategy card.
    title_map["technology"] = "technology"
    title_map["technology (strategy card)"] = "technology-strategy-card"
    unresolved = []
    for entry in entries:
        for related in entry["relatedTopics"]:
            target = title_map.get(related["title"].lower())
            if target:
                related["slug"] = target
            else:
                unresolved.append(f'{entry["title"]} -> {related["title"]}')
    return unresolved

def main() -> None:
    if not PDF.exists():
        sys.exit(f"Missing source PDF: {PDF}")
    entries = find_topics(extract_lines())
    add_aliases(entries)
    unresolved = resolve_related(entries)
    payload = {
        "meta": {
            "title": "Twilight Imperium: Fourth Edition Rules Reference",
            "edition": "Fourth Edition base game",
            "sourceVersion": "TI-K0289; PDF modified 2017-08-15",
            "sourceUrl": "https://images-cdn.fantasyflightgames.com/filer_public/c2/69/c269b9e2-8d9a-420b-a807-2b164dd54977/ti-k0289_rules_referencecompressed.pdf",
            "generatedOn": date.today().isoformat(),
            "baseGameOnly": True,
            "sourcePageCount": 32
        },
        "entries": entries,
        "extractionWarnings": unresolved
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(entries)} topics to {OUTPUT}")
    print(f"Unresolved related-topic references: {len(unresolved)}")

if __name__ == "__main__":
    main()
