import "./styles.css";
import rules from "./data/rules.json";

type RuleSection = {
  id: string;
  heading?: string;
  content: string;
  bullets: string[];
  sourcePage: number;
};
type RelatedTopic = { title: string; slug: string };
type Entry = {
  number: string;
  title: string;
  slug: string;
  aliases: string[];
  sourcePages: number[];
  introduction: string;
  sections: RuleSection[];
  relatedTopics: RelatedTopic[];
};

const entries = rules.entries as Entry[];
const app = document.querySelector<HTMLDivElement>("#app")!;
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const normalize = (text: string) =>
  text.toLocaleLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const entryText = (entry: Entry) =>
  normalize([
    entry.title, entry.number, ...entry.aliases, entry.introduction,
    ...entry.relatedTopics.map(item => item.title),
    ...entry.sections.flatMap(section => [section.id, section.heading ?? "", section.content, ...section.bullets])
  ].join(" "));

const searchable = new Map(entries.map(entry => [entry.slug, entryText(entry)]));
const entriesByLetter = entries.reduce((groups, entry) => {
  const letter = entry.title[0].toUpperCase();
  groups.set(letter, [...(groups.get(letter) ?? []), entry]);
  return groups;
}, new Map<string, Entry[]>());

app.innerHTML = `
  <header class="site-header">
    <div class="header-inner">
      <a class="identity" href="./" aria-label="TI4 Quick Guide home">
        <span class="title">TI4 Quick Guide</span>
        <span class="subtitle">Fourth Edition · base-game rules</span>
      </a>
      <div class="search-wrap">
        <label class="sr-only" for="rules-search">Search rules</label>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"/></svg>
        <input id="rules-search" type="search" autocomplete="off" spellcheck="false"
          placeholder="Search topics, text, or 38.2…" />
        <button id="clear-search" class="icon-button" type="button" aria-label="Clear search" title="Clear search">×</button>
      </div>
      <button id="theme-toggle" class="theme-button" type="button" aria-label="Toggle color theme" title="Toggle color theme">◐</button>
    </div>
  </header>
  <main>
    <section class="hero" aria-labelledby="guide-heading">
      <div class="eyebrow">Table-ready rules navigator</div>
      <h1 id="guide-heading">The galaxy is vast.<br><em>The rule you need isn’t.</em></h1>
      <p class="notice">An unofficial, fan-made quick reference for Twilight Imperium: Fourth Edition.
        Rules are based on the official Fantasy Flight Games Rules Reference. This site is not affiliated
        with or endorsed by Fantasy Flight Games or Asmodee.</p>
      <dl class="source-meta">
        <div><dt>Rules source</dt><dd><a href="${rules.meta.sourceUrl}" target="_blank" rel="noreferrer">Official Rules Reference ↗</a></dd></div>
        <div><dt>Edition</dt><dd>${rules.meta.edition}</dd></div>
        <div><dt>Document</dt><dd>${rules.meta.sourceVersion}</dd></div>
        <div><dt>Local data</dt><dd>${rules.meta.generatedOn} · Base game only</dd></div>
      </dl>
    </section>
    <nav class="alphabet" aria-label="Glossary letters">
      ${alphabet.map(letter => {
        const enabled = entriesByLetter.has(letter);
        return enabled ? `<a href="#letter-${letter.toLowerCase()}">${letter}</a>` : `<span aria-disabled="true">${letter}</span>`;
      }).join("")}
    </nav>
    <section id="glossary" class="glossary" aria-labelledby="glossary-title">
      <div class="section-heading">
        <div><span class="eyebrow">Complete glossary</span><h2 id="glossary-title">Rules, A–Z</h2></div>
        <p id="result-count">${entries.length} topics · ${entries.reduce((sum, entry) => sum + entry.sections.length, 0)} numbered paragraphs</p>
      </div>
      <div id="results"></div>
      <div id="empty-state" class="empty-state" hidden>
        <span>∅</span><h2>No rules found</h2><p>Try a topic, a rule number, or fewer words.</p>
        <button type="button" data-clear-search>Clear search</button>
      </div>
    </section>
  </main>
  <footer>
    <p>Unofficial fan reference · Rule text © Fantasy Flight Games / Asmodee</p>
    <a href="#guide-heading">Back to top ↑</a>
  </footer>`;

const results = document.querySelector<HTMLDivElement>("#results")!;
const search = document.querySelector<HTMLInputElement>("#rules-search")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear-search")!;
const count = document.querySelector<HTMLParagraphElement>("#result-count")!;
const empty = document.querySelector<HTMLDivElement>("#empty-state")!;

function renderEntry(entry: Entry, query = ""): string {
  const terms = normalize(query).split(" ").filter(Boolean);
  const highlight = (text: string) => {
    if (!terms.length) return escapeHtml(text);
    const escaped = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return escapeHtml(text).replace(new RegExp(`(${escaped.join("|")})`, "gi"), "<mark>$1</mark>");
  };
  const pages = entry.sourcePages.length === 1
    ? `p. ${entry.sourcePages[0]}`
    : `pp. ${entry.sourcePages[0]}–${entry.sourcePages.at(-1)}`;
  return `<article id="${entry.slug}" class="topic" data-topic="${entry.slug}">
    <div class="topic-topline">
      <span class="topic-number">${entry.number.padStart(2, "0")}</span>
      <button class="copy-link" type="button" data-copy="#${entry.slug}" aria-label="Copy link to ${escapeHtml(entry.title)}">Copy link</button>
    </div>
    <h3><a href="#${entry.slug}">${highlight(entry.title)}</a></h3>
    ${entry.aliases.length ? `<p class="aliases">Also: ${entry.aliases.map(highlight).join(", ")}</p>` : ""}
    <p class="introduction">${highlight(entry.introduction)}</p>
    <div class="rules">
      ${entry.sections.map(section => `
        <div id="${section.id}" class="rule">
          <a class="rule-id" href="#${section.id}" aria-label="Link to rule ${section.id}">${section.id}</a>
          <div>
            ${section.heading ? `<h4>${highlight(section.heading)}</h4>` : ""}
            ${section.content ? `<p>${highlight(section.content)}</p>` : ""}
            ${section.bullets.length ? `<ul>${section.bullets.map(bullet => `<li>${highlight(bullet)}</li>`).join("")}</ul>` : ""}
          </div>
        </div>`).join("")}
    </div>
    <div class="topic-footer">
      ${entry.relatedTopics.length ? `<div class="related"><strong>Related</strong>${entry.relatedTopics.map(item => `<a href="#${item.slug}">${escapeHtml(item.title)}</a>`).join("")}</div>` : "<span></span>"}
      <a class="source-page" href="${rules.meta.sourceUrl}#page=${entry.sourcePages[0]}" target="_blank" rel="noreferrer">${pages} ↗</a>
    </div>
  </article>`;
}

function render(query = "") {
  const normalizedQuery = normalize(query);
  const matches = normalizedQuery
    ? entries.filter(entry => normalizedQuery.split(" ").every(term => searchable.get(entry.slug)!.includes(term)))
    : entries;
  empty.hidden = matches.length > 0;
  results.hidden = matches.length === 0;
  count.textContent = normalizedQuery
    ? `${matches.length} ${matches.length === 1 ? "topic" : "topics"} matching “${query}”`
    : `${entries.length} topics · ${entries.reduce((sum, entry) => sum + entry.sections.length, 0)} numbered paragraphs`;

  if (normalizedQuery) {
    results.innerHTML = `<div class="search-grid">${matches.map(entry => renderEntry(entry, query)).join("")}</div>`;
  } else {
    results.innerHTML = [...entriesByLetter.entries()].map(([letter, letterEntries]) => `
      <section id="letter-${letter.toLowerCase()}" class="letter-group" aria-labelledby="heading-${letter.toLowerCase()}">
        <h2 id="heading-${letter.toLowerCase()}">${letter}</h2>
        <div class="topic-grid">${letterEntries.map(entry => renderEntry(entry)).join("")}</div>
      </section>`).join("");
  }
}

function setQuery(value: string, replace = true) {
  search.value = value;
  clearButton.classList.toggle("visible", Boolean(value));
  const url = new URL(location.href);
  value ? url.searchParams.set("q", value) : url.searchParams.delete("q");
  history[replace ? "replaceState" : "pushState"]({}, "", url);
  render(value);
}

let searchTimer = 0;
search.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => setQuery(search.value), 80);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && search.value) {
    setQuery("");
    search.focus();
  } else if (event.key === "/" && document.activeElement !== search) {
    event.preventDefault();
    search.focus();
  }
});
document.addEventListener("click", async event => {
  const target = event.target as HTMLElement;
  if (target.closest("#clear-search, [data-clear-search]")) {
    setQuery("");
    search.focus();
  }
  const copy = target.closest<HTMLButtonElement>("[data-copy]");
  if (copy) {
    const url = new URL(location.href);
    url.hash = copy.dataset.copy!;
    await navigator.clipboard.writeText(url.toString());
    copy.textContent = "Copied";
    window.setTimeout(() => copy.textContent = "Copy link", 1200);
  }
});

const savedTheme = localStorage.getItem("ti4-theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
document.querySelector("#theme-toggle")!.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("ti4-theme", next);
});

function emphasizeHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (target) {
    target.classList.remove("hash-target");
    requestAnimationFrame(() => target.classList.add("hash-target"));
    target.scrollIntoView({ block: "start" });
  }
}

const initialQuery = new URL(location.href).searchParams.get("q") ?? "";
setQuery(initialQuery);
window.addEventListener("hashchange", emphasizeHash);
window.setTimeout(emphasizeHash, 50);
