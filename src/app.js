(function () {
  const D = window.DATA;
  const COL = { l08: '#e8590c', l09: '#2f6fed', l10: '#7048e8', l11: '#2b8a3e', l12: '#c2255c' };
  const $ = (q, r) => (r || document).querySelector(q);
  const $$ = (q, r) => [...(r || document).querySelectorAll(q)];
  const main = $('#main'), side = $('#side'), pop = $('#pop');
  const lecById = Object.fromEntries(D.lectures.map((l) => [l.id, l]));
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  let done = store.get('done', {});
  const key = (l, s) => l + '/' + s.id;
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ordered = D.lectures.flatMap((l) => l.sections.map((s) => [l, s]));

  // ---------- theme ----------
  const setTheme = (t) => { document.documentElement.dataset.theme = t; store.set('theme', t); };
  setTheme(store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('#themebtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('#menu').onclick = () => { side.classList.toggle('hide'); side.classList.toggle('show'); };

  // ---------- sidebar ----------
  const GROUP = { content: null, summary: 'Wrap-up', partA: 'Practice', partB: 'Practice', partC: 'Practice' };
  function renderSide(cur) {
    side.innerHTML = '';
    D.lectures.forEach((l) => {
      const open = cur && cur.l === l.id;
      const wrap = document.createElement('div'); wrap.className = 'nl';
      const total = l.sections.filter((s) => s.kind === 'content').length;
      const nd = l.sections.filter((s) => s.kind === 'content' && done[key(l.id, s)]).length;
      wrap.innerHTML = `<a class="lh" href="#/${l.id}/${l.sections[0].id}"><span class="dot" style="background:${COL[l.id]}"></span>${l.num} ${esc(l.title)}<small style="margin-left:auto;color:var(--mute)">${nd}/${total}</small></a>`;
      if (open) {
        const secs = document.createElement('div'); secs.className = 'secs';
        let last = null;
        l.sections.forEach((s) => {
          const g = GROUP[s.kind];
          if (g && g !== last) { secs.insertAdjacentHTML('beforeend', `<div class="grp">${g}</div>`); }
          last = g;
          const has = window.WIDGETS.some((w) => w.lec === l.id && w.n === s.n);
          secs.insertAdjacentHTML('beforeend', `<a class="si ${cur.s === s.id ? 'on' : ''} ${done[key(l.id, s)] ? 'done' : ''}" href="#/${l.id}/${s.id}">${s.n ? s.n + '.' : ''} ${esc(s.title)}<span class="v">${has ? '&#9881;' : ''}${done[key(l.id, s)] ? ' &#10003;' : ''}</span></a>`);
        });
        wrap.append(secs);
      }
      side.append(wrap);
    });
  }

  // ---------- home: concept map + cards ----------
  function home() {
    renderSide(null);
    const cont = store.get('last', null);
    main.innerHTML = `<div class="hero"><h1>DES431 final, as something you can poke</h1><p>Five lectures, one map. Terms that show up in more than one lecture sit between them: click a term to see where each lecture explains it. Sections marked &#9881; in the sidebar have a hands-on lab.</p>${cont ? `<p><a href="#/${cont}">Continue where you left off &rarr;</a></p>` : ''}</div>
    <div class="mapwrap"><svg id="map" viewBox="0 0 1000 520"></svg><div class="cap">Lectures (big circles) and terms shared between them. Drag a node. Click to open.</div></div>
    <div class="cards">${D.lectures.map((l) => {
      const c = l.sections.filter((s) => s.kind === 'content'), n = c.filter((s) => done[key(l.id, s)]).length;
      const labs = window.WIDGETS.filter((w) => w.lec === l.id).length;
      return `<a class="card" style="--c:${COL[l.id]}" href="#/${l.id}/${l.sections[0].id}"><h3>${l.num}. ${esc(l.title)}</h3><small>${c.length} sections, ${labs} labs</small><div class="bar"><i style="width:${(n / c.length) * 100}%"></i></div></a>`;
    }).join('')}</div>`;
    drawMap($('#map'));
  }

  function drawMap(svg) {
    const NS = 'http://www.w3.org/2000/svg';
    const W0 = 1000, H0 = 520;
    const nodes = [];
    D.lectures.forEach((l, i) => nodes.push({ id: l.id, lec: true, x: 120 + i * 190, y: H0 / 2 + (i % 2 ? 40 : -40), fx: 120 + i * 190, fy: H0 / 2 + (i % 2 ? 90 : -90), r: 38, label: l.num + ' ' + l.title.split(' ').slice(0, 2).join(' ') }));
    const links = [];
    D.terms.forEach((t, i) => {
      const ls = Object.keys(t.lec);
      const n = { id: 't' + i, term: t, x: ls.reduce((a, l) => a + nodes.find((q) => q.id === l).x, 0) / ls.length + (i % 5) * 4, y: H0 / 2 + ((i % 7) - 3) * 30, r: 7 + Math.min(10, Object.values(t.lec).reduce((a, b) => a + b, 0)), label: t.t };
      nodes.push(n);
      ls.forEach((l) => links.push({ a: n, b: nodes.find((q) => q.id === l) }));
    });
    for (let it = 0; it < 260; it++) {
      nodes.forEach((a) => { if (a.lec) { a.x = a.fx; a.y = a.fy; return; } a.vx = 0; a.vy = 0; });
      nodes.forEach((a, i) => nodes.slice(i + 1).forEach((b) => { const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.1, d = Math.sqrt(d2), f = 900 / d2; if (!a.lec) { a.vx += dx / d * f; a.vy += dy / d * f; } if (!b.lec) { b.vx -= dx / d * f; b.vy -= dy / d * f; } }));
      links.forEach((e) => { const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y; e.a.vx += dx * 0.012; e.a.vy += dy * 0.012; });
      nodes.forEach((a) => { if (a.lec) return; a.x = Math.max(40, Math.min(W0 - 40, a.x + Math.max(-8, Math.min(8, a.vx)))); a.y = Math.max(30, Math.min(H0 - 30, a.y + Math.max(-8, Math.min(8, a.vy)))); });
    }
    const g = document.createElementNS(NS, 'g'); svg.append(g);
    const lines = links.map((e) => { const ln = document.createElementNS(NS, 'line'); ln.setAttribute('stroke', COL[e.b.id]); ln.setAttribute('stroke-opacity', '.35'); g.append(ln); return [ln, e]; });
    const place = () => { lines.forEach(([ln, e]) => { ln.setAttribute('x1', e.a.x); ln.setAttribute('y1', e.a.y); ln.setAttribute('x2', e.b.x); ln.setAttribute('y2', e.b.y); }); nodes.forEach((n) => n.el.setAttribute('transform', `translate(${n.x},${n.y})`)); };
    nodes.forEach((n) => {
      const el = document.createElementNS(NS, 'g'); el.setAttribute('class', n.lec ? 'lec' : 'term'); n.el = el;
      if (n.lec) el.innerHTML = `<circle r="${n.r}" fill="${COL[n.id]}"/><text text-anchor="middle" y="4">${esc(n.label.split(' ').slice(0, 2).join(' '))}</text>`;
      else el.innerHTML = `<circle r="${n.r}" fill="var(--panel)" stroke="var(--mute)"/><text y="${n.r + 12}" text-anchor="middle">${esc(n.label)}</text>`;
      let drag = false, moved = false;
      el.addEventListener('pointerdown', (e) => { drag = true; moved = false; el.setPointerCapture(e.pointerId); });
      el.addEventListener('pointermove', (e) => { if (!drag) return; moved = true; const r = svg.getBoundingClientRect(); n.x = (e.clientX - r.left) / r.width * W0; n.y = (e.clientY - r.top) / r.height * H0; place(); });
      el.addEventListener('pointerup', (e) => {
        drag = false;
        if (moved) return;
        if (n.lec) location.hash = `#/${n.id}/${lecById[n.id].sections[0].id}`;
        else showTermPop(n.term, e.clientX, e.clientY);
      });
      g.append(el);
    });
    place();
  }
  function showTermPop(t, x, y) {
    const rows = Object.keys(t.lec).map((l) => { const sec = lecById[l].sections.find((s) => s.id === t.sec[l]); return `<a href="#/${l}/${sec.id}" style="color:${COL[l]}">Lecture ${lecById[l].num}: ${esc(sec.title)} (${t.lec[l]}x)</a>`; }).join('');
    const g = D.glossary.find((q) => q.term.toLowerCase() === t.t.toLowerCase());
    pop.innerHTML = `<b>${esc(t.t)}</b>${g ? esc(g.def) : ''}${rows}`;
    placePop(x, y);
  }
  function placePop(x, y) { pop.hidden = false; const w = pop.offsetWidth; pop.style.left = Math.min(innerWidth - w - 10, x + 8) + 'px'; pop.style.top = Math.min(innerHeight - pop.offsetHeight - 10, y + 12) + 'px'; }
  document.addEventListener('click', (e) => { if (!e.target.closest('#pop, .term, .gl')) pop.hidden = true; });

  // ---------- section view ----------
  function section(lid, sid) {
    const l = lecById[lid], idx = ordered.findIndex(([a, b]) => a.id === lid && b.id === sid);
    if (idx < 0) return home();
    const sec = ordered[idx][1];
    store.set('last', `${lid}/${sid}`);
    renderSide({ l: lid, s: sid });
    const prev = ordered[idx - 1], next = ordered[idx + 1];
    const label = ([a, b]) => `<small>${a.num} ${esc(a.title)}</small>${b.n ? b.n + '. ' : ''}${esc(b.title)}`;
    const isDone = !!done[key(lid, sec)];
    main.style.setProperty('--c', COL[lid]);
    main.innerHTML = `<div class="crumb"><a href="#/">Map</a> / <a href="#/${lid}/${l.sections[0].id}">${l.num} ${esc(l.title)}</a></div>
    <div class="sechead"><h1>${sec.n ? sec.n + '. ' : ''}${esc(sec.title)}</h1>${sec.kind === 'content' ? `<button class="donebtn ${isDone ? 'on' : ''}" id="donebtn">${isDone ? '&#10003; understood' : 'mark understood'}</button>` : ''}</div>
    <div class="layout"><div><div id="labs"></div><div class="content" id="content">${sec.html}</div>
    <div class="nav2">${prev ? `<a href="#/${prev[0].id}/${prev[1].id}">&larr; ${label(prev)}</a>` : '<span></span>'}${next ? `<a href="#/${next[0].id}/${next[1].id}">${label(next)} &rarr;</a>` : '<span></span>'}</div></div>
    <aside class="toc" id="toc"></aside></div>`;
    $('#donebtn') && ($('#donebtn').onclick = () => { done[key(lid, sec)] = !done[key(lid, sec)]; store.set('done', done); section(lid, sid); });
    // labs first: see it, then read it
    window.WIDGETS.filter((w) => w.lec === lid && w.n === sec.n && sec.kind === 'content').forEach((w) => {
      const box = document.createElement('div'); box.className = 'lab';
      box.innerHTML = `<h4>&#9881; Lab: ${esc(w.title)}</h4><p class="sub">${esc(w.sub)}</p>`;
      $('#labs').append(box);
      try { w.mount(box); } catch (e) { box.append('lab failed: ' + e.message); console.error(e); }
    });
    enhance($('#content'), sec);
    window.scrollTo(0, 0);
  }

  function enhance(root, sec) {
    // fold H3 groups
    const h3s = $$('h3', root);
    if (h3s.length >= 3) {
      h3s.forEach((h) => {
        const det = document.createElement('details'); det.className = 'fold'; det.open = true;
        const sum = document.createElement('summary'); sum.innerHTML = h.innerHTML; sum.id = h.id;
        h.before(det); det.append(sum);
        while (det.nextSibling && !(det.nextSibling.nodeName === 'H3')) det.append(det.nextSibling);
        h.remove();
      });
      const bar = document.createElement('div'); bar.className = 'foldbar';
      bar.innerHTML = '<button data-a="1">expand all</button><button data-a="0">collapse all</button>';
      bar.onclick = (e) => { if (e.target.dataset.a) $$('details.fold', root).forEach((d) => (d.open = e.target.dataset.a === '1')); };
      root.prepend(bar);
    }
    // TOC
    const toc = $('#toc');
    const heads = $$('summary[id], h3[id], h4[id]', root).filter((h) => h.tagName !== 'H4');
    if (heads.length) {
      toc.innerHTML = '<div class="t">In this section</div>' + heads.map((h) => `<a href="#" data-id="${h.id}">${esc(h.textContent)}</a>`).join('');
      toc.onclick = (e) => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); const t = document.getElementById(a.dataset.id); const d = t.closest('details'); if (d) d.open = true; t.scrollIntoView(); };
      const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) $$('a', toc).forEach((a) => a.classList.toggle('on', a.dataset.id === en.target.id)); }), { rootMargin: '-60px 0px -70% 0px' });
      heads.forEach((h) => io.observe(h));
    }
    // diagrams: step through
    $$('.diagram', root).forEach((d) => {
      const lines = $$('.ln', d); if (lines.length < 4) return;
      const bar = document.createElement('div'); bar.className = 'dbtn';
      let i = lines.length;
      const set = (n) => { i = Math.max(0, Math.min(lines.length, n)); d.classList.toggle('step', i < lines.length); lines.forEach((l, k) => l.classList.toggle('off', k >= i)); };
      bar.innerHTML = '<button>step</button><button>all</button>';
      bar.children[0].onclick = () => set(i >= lines.length ? 1 : i + 1);
      bar.children[1].onclick = () => set(lines.length);
      d.append(bar);
    });
    // code copy
    $$('.code', root).forEach((c) => { const b = document.createElement('button'); b.className = 'cbtn'; b.textContent = 'copy'; b.onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('code', c).textContent); b.textContent = 'copied'; setTimeout(() => (b.textContent = 'copy'), 900); }; c.append(b); });
    // tables: filter + sort
    $$('.tbl', root).forEach((w) => {
      const t = $('table', w), rows = $$('tbody tr', t);
      if (rows.length > 5) { const f = document.createElement('input'); f.className = 'tfilter'; f.placeholder = 'filter rows...'; f.oninput = () => rows.forEach((r) => (r.style.display = r.textContent.toLowerCase().includes(f.value.toLowerCase()) ? '' : 'none')); w.before(f); }
      $$('th', t).forEach((th, ci) => { let asc = true; th.title = 'click to sort'; th.onclick = () => { const body = $('tbody', t); [...rows].sort((a, b) => a.cells[ci].textContent.localeCompare(b.cells[ci].textContent, undefined, { numeric: true }) * (asc ? 1 : -1)).forEach((r) => body.append(r)); asc = !asc; }; });
      rows.forEach((r) => r.addEventListener('click', () => r.classList.toggle('sel')));
    });
    // glossary hover: first mention of each defined term in this section
    if (sec.kind === 'content' || sec.kind === 'summary') glossarize(root);
  }

  const gl = D.glossary.filter((g) => g.term.length >= 4 && !/^\d/.test(g.term)).sort((a, b) => b.term.length - a.term.length);
  function glossarize(root) {
    const seen = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('pre, code, summary, h1, h2, h3, th, a, .gl') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      for (const g of gl) {
        if (seen.has(g.term)) continue;
        const i = n.nodeValue.toLowerCase().indexOf(g.term.toLowerCase());
        if (i < 0) continue;
        const pre = n.nodeValue[i - 1], post = n.nodeValue[i + g.term.length];
        if ((pre && /\w/.test(pre)) || (post && /\w/.test(post))) continue;
        seen.add(g.term);
        const mid = n.splitText(i); mid.splitText(g.term.length);
        const sp = document.createElement('span'); sp.className = 'gl'; sp.textContent = mid.nodeValue; sp.dataset.term = g.term;
        mid.replaceWith(sp);
        return;
      }
    });
    root.addEventListener('mouseover', (e) => { const sp = e.target.closest('.gl'); if (!sp) return; const g = gl.find((q) => q.term === sp.dataset.term); const r = sp.getBoundingClientRect(); pop.innerHTML = `<b>${esc(g.term)}</b>${esc(g.def)}`; placePop(r.left, r.bottom - 8); });
    root.addEventListener('mouseout', (e) => { if (e.target.closest('.gl')) pop.hidden = true; });
  }

  // ---------- search ----------
  const idx = ordered.map(([l, s]) => ({ l, s, t: (s.title + ' ' + s.text), lt: (s.title + ' ' + s.text).toLowerCase() }));
  const qEl = $('#q'), resEl = $('#results'), box = $('#search');
  let cur = 0;
  function openSearch() { box.hidden = false; qEl.value = ''; resEl.innerHTML = ''; qEl.focus(); }
  function runSearch() {
    const terms = qEl.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) { resEl.innerHTML = ''; return; }
    const hits = idx.map((e) => {
      let sc = 0;
      for (const t of terms) { const c = e.lt.split(t).length - 1; if (!c) return null; sc += Math.min(c, 8) + (e.s.title.toLowerCase().includes(t) ? 12 : 0); }
      return { e, sc };
    }).filter(Boolean).sort((a, b) => b.sc - a.sc).slice(0, 12);
    resEl.innerHTML = hits.map(({ e }) => {
      const p = e.lt.indexOf(terms[0]), snip = e.t.slice(Math.max(0, p - 50), p + 110);
      const m = esc(snip).replace(new RegExp('(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig'), '<mark>$1</mark>');
      return `<a href="#/${e.l.id}/${e.s.id}"><b>${e.s.n ? e.s.n + '. ' : ''}${esc(e.s.title)}</b><small>${e.l.num} ${esc(e.l.title)}</small><small>...${m}...</small></a>`;
    }).join('') || '<a>No match</a>';
    cur = 0; $$('a', resEl)[0] && $$('a', resEl)[0].classList.add('on');
  }
  qEl.oninput = runSearch;
  qEl.onkeydown = (e) => {
    const as = $$('a', resEl);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(0, Math.min(as.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1))); as.forEach((a, i) => a.classList.toggle('on', i === cur)); as[cur] && as[cur].scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter' && as[cur] && as[cur].href) { location.hash = as[cur].getAttribute('href'); box.hidden = true; }
    if (e.key === 'Escape') box.hidden = true;
  };
  box.onclick = (e) => { if (e.target === box || e.target.closest('a')) box.hidden = true; };
  $('#searchbtn').onclick = openSearch;
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) { e.preventDefault(); openSearch(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const m = location.hash.match(/#\/(l\d+)\/(s\d+)/); if (!m) return;
      const i = ordered.findIndex(([a, b]) => a.id === m[1] && b.id === m[2]), t = ordered[i + (e.key === 'ArrowRight' ? 1 : -1)];
      if (t) location.hash = `#/${t[0].id}/${t[1].id}`;
    }
  });

  // ---------- router ----------
  function route() {
    pop.hidden = true;
    const m = location.hash.match(/^#\/(l\d+)\/(s\d+)/);
    if (m && lecById[m[1]]) section(m[1], m[2]); else home();
  }
  addEventListener('hashchange', route);
  route();
})();
