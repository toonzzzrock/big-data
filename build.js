// Build: summarize/*.md -> dist/data.js (+ copies src/* into dist/)
const fs = require('fs');
const path = require('path');
const { Marked } = require('marked');

const SRC = path.resolve(__dirname, '../summarize');
const OUT = path.resolve(__dirname, 'dist');

const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (s) => s.replace(/\*\*|`|\*|_/g, '').trim();

const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slug(text);
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    code({ text, lang }) {
      if (!lang || lang === 'text') {
        const lines = text.split('\n').map((l) => `<span class="ln">${esc(l) || ' '}</span>`).join('');
        return `<div class="diagram" data-n="${text.split('\n').length}"><pre>${lines}</pre></div>\n`;
      }
      return `<div class="code" data-lang="${lang}"><pre><code>${esc(text)}</code></pre></div>\n`;
    },
    blockquote({ tokens }) {
      const inner = this.parser.parse(tokens);
      const cls = /exam|important|trap|note/i.test(inner.slice(0, 160)) ? 'callout exam' : 'callout';
      return `<blockquote class="${cls}">${inner}</blockquote>\n`;
    },
    table(token) {
      const head = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join('');
      const rows = token.rows
        .map((r) => '<tr>' + r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join('') + '</tr>')
        .join('');
      return `<div class="tbl"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
    },
  },
});

function kindOf(title) {
  if (/^Part A/i.test(title)) return 'partA';
  if (/^Part B/i.test(title)) return 'partB';
  if (/^Part C/i.test(title)) return 'partC';
  if (/Lecture Summary/i.test(title)) return 'summary';
  return 'content';
}

function parseLecture(file, dir = SRC, trackId = null) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const tokens = marked.lexer(raw);
  const links = tokens.links;
  const num = trackId ? '' : file.slice(0, 2);
  let title = '';
  const metaTokens = [];
  const sections = [];
  let cur = null;
  for (const t of tokens) {
    if (t.type === 'heading' && t.depth === 1) { title = plain(t.text); continue; }
    if (t.type === 'heading' && t.depth === 2) {
      cur = { title: plain(t.text), tokens: [] };
      sections.push(cur);
      continue;
    }
    if (t.type === 'hr' && !cur) continue;
    (cur ? cur.tokens : metaTokens).push(t);
  }
  const mk = (toks) => { const a = toks.slice(); a.links = links; return marked.parser(a); };
  const out = sections.map((s, i) => {
    const kind = kindOf(s.title);
    const nm = s.title.match(/^(\d+)\.\s*(.*)$/);
    const h3 = s.tokens.filter((t) => t.type === 'heading' && t.depth === 3).map((t) => ({ id: slug(this_inline(t)), title: plain(t.text) }));
    const rawText = s.tokens.map((t) => t.raw).join('');
    return {
      id: `s${i + 1}`,
      n: nm ? Number(nm[1]) : null,
      title: nm ? plain(nm[2]) : s.title,
      kind,
      html: mk(s.tokens),
      h3,
      text: rawText.replace(/```[\s\S]*?```/g, (m) => m).replace(/[*`|#>_-]+/g, ' ').replace(/\s+/g, ' ').trim(),
      raw: rawText,
    };
  });
  return { id: trackId || 'l' + num, num, file, title: title.replace(/^Lecture \d+\s*[—-]\s*/, ''), meta: mk(metaTokens), sections: out };
}
function this_inline(t) { return marked.parseInline(t.text).replace(/<[^>]+>/g, ''); }

const files = fs.readdirSync(SRC).filter((f) => /^\d\d-.*\.md$/.test(f) && !f.startsWith('00')).sort();
const lectures = files.map((f) => parseLecture(f));

// glossary from Part A tables
const glossary = [];
for (const L of lectures) {
  for (const s of L.sections.filter((x) => x.kind === 'partA')) {
    for (const line of s.raw.split('\n')) {
      const m = line.match(/^\|\s*\d+\s*\|\s*(.+?)\s*\|\s*\*\*(.+?)\*\*\s*\|/);
      if (m) glossary.push({ term: m[2].trim(), def: plain(m[1]), lec: L.id });
    }
  }
}

// shared bold terms across lectures -> concept graph data
const GENERIC = new Set(['all', 'console', 'interactive shell', 'definition', 'why it matters', 'example', 'note', 'key']);
const termMap = new Map();
for (const L of lectures) {
  for (const s of L.sections) {
    if (s.kind !== 'content') continue;
    for (const m of s.raw.matchAll(/\*\*([^*\n]{3,32}?)\*\*/g)) {
      if (/[:.,;]$/.test(m[1].trim())) continue; // labels like **Definition:** are not concepts
      const t = m[1].trim();
      if (GENERIC.has(t.toLowerCase())) continue;
      if (!/^[A-Za-z][A-Za-z0-9 \-/()]+$/.test(t)) continue;
      const k = t.toLowerCase();
      if (!termMap.has(k)) termMap.set(k, { t, lec: {}, sec: {} });
      const e = termMap.get(k);
      e.lec[L.id] = (e.lec[L.id] || 0) + 1;
      if (!e.sec[L.id]) e.sec[L.id] = s.id;
    }
  }
}
const terms = [...termMap.values()]
  .filter((e) => Object.keys(e.lec).length >= 2)
  .sort((a, b) => Object.values(b.lec).reduce((x, y) => x + y, 0) - Object.values(a.lec).reduce((x, y) => x + y, 0))
  .slice(0, 36);

// learn-from-scratch tracks: learn/*.md -> separate tabs, kept out of the lecture map/glossary
const LEARN = path.resolve(__dirname, '../learn');
const TRACKS = [['hql', 'hiveql.md', 'HiveQL'], ['pys', 'pyspark.md', 'PySpark']];
const tracks = TRACKS.filter(([, f]) => fs.existsSync(path.join(LEARN, f)))
  .map(([id, f, label]) => ({ ...parseLecture(f, LEARN, id), label }));

const strip = (L) => ({ ...L, sections: L.sections.map(({ raw, ...r }) => r) });
const data = {
  lectures: lectures.map(strip),
  tracks: tracks.map(strip),
  glossary,
  terms,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'data.js'), 'window.DATA=' + JSON.stringify(data) + ';');
for (const f of fs.readdirSync(path.join(__dirname, 'src'))) fs.copyFileSync(path.join(__dirname, 'src', f), path.join(OUT, f));
console.log(JSON.stringify({
  lectures: lectures.map((L) => ({ id: L.id, sections: L.sections.length, tables: (L.sections.map((s) => s.html).join('').match(/<table/g) || []).length, diagrams: (L.sections.map((s) => s.html).join('').match(/class="diagram"/g) || []).length })),
  tracks: tracks.map((T) => ({ id: T.id, sections: T.sections.length })),
  glossary: glossary.length, sharedTerms: terms.length,
}));
