// UI pass: node test/ui.js  (needs system chromium + playwright-core). Drives every lab control.
const { chromium } = require('playwright-core');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../dist/index.html');
const ROUTES = ['l08/s5', 'l08/s7', 'l09/s4', 'l09/s9', 'l10/s15', 'l11/s4', 'l11/s5', 'l12/s3'];
const fails = [];
const bad = (m) => { fails.push(m); console.log('FAIL', m); };

(async () => {
  const br = await chromium.launch({ executablePath: '/run/current-system/sw/bin/chromium', args: ['--no-sandbox'] });
  for (const [w, hgt] of [[1280, 900], [390, 800]]) {
    const ctx = await br.newContext({ viewport: { width: w, height: hgt } });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', (e) => errs.push(String(e)));
    pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    const check = async (tag) => {
      const r = await pg.evaluate(() => {
        const labs = [...document.querySelectorAll('.lab')];
        const svg = labs.map((l) => l.innerHTML).join('');
        const badAttr = (svg.match(/(?:x|y|cx|cy|width|height|r|opacity)="(?:NaN|-?Infinity|undefined)"/g) || []).concat(svg.match(/(?:width|height|opacity)="-[\d.]+"/g) || []);
        return { failed: /lab failed/.test(document.body.innerText), badAttr, sw: document.documentElement.scrollWidth, iw: innerWidth, zero: labs.some((l) => l.offsetHeight === 0 || l.offsetWidth === 0), nan: /NaN|undefined/.test(labs.map((l) => l.innerText).join('')) };
      });
      if (r.failed) bad(`${tag}: lab failed`);
      if (r.badAttr.length) bad(`${tag}: bad svg attrs ${r.badAttr.slice(0, 3)}`);
      if (r.nan) bad(`${tag}: NaN/undefined in lab text`);
      if (r.sw > r.iw + 1) bad(`${tag}: horizontal overflow ${r.sw}>${r.iw}`);
      if (r.zero) bad(`${tag}: zero-size lab`);
    };
    for (const route of ROUTES) {
      await pg.goto(URL + '#/' + route); await pg.reload();
      const tag = `${w}px ${route}`;
      await check(tag + ' initial');
      // folds hold content
      const folds = await pg.evaluate(() => [...document.querySelectorAll('details.fold')].map((d) => d.children.length));
      if (folds.some((n) => n < 2)) bad(`${tag}: empty fold`);
      const lab = pg.locator('.lab').first();
      for (const r of await lab.locator('input[type=range]').all()) {
        for (const v of ['min', 'max']) {
          await r.evaluate((el, which) => { el.value = el.getAttribute(which); el.dispatchEvent(new Event('input')); }, v);
          await check(`${tag} range ${v}`);
        }
      }
      for (const c of await lab.locator('input[type=checkbox]').all()) { await c.click(); await check(tag + ' checkbox'); await c.click(); }
      for (const s of await lab.locator('select').all()) {
        const n = await s.locator('option').count();
        for (let i = 0; i < n; i++) { await s.selectOption({ index: i }); await check(tag + ' select'); }
      }
      const nb = await lab.locator('button.b').count();
      for (let i = 0; i < nb; i++) { await lab.locator('button.b').nth(i).click(); await check(`${tag} button ${i}`); }
      if (route === 'l10/s15') { await lab.locator('svg').click({ position: { x: 200, y: 100 } }); await check(tag + ' timeline click'); }
    }
    // fold collapse really hides content
    await pg.goto(URL + '#/l08/s5'); await pg.reload();
    const h0 = await pg.evaluate(() => document.querySelector('#content').offsetHeight);
    await pg.locator('button[data-a="0"]').click();
    const h1 = await pg.evaluate(() => document.querySelector('#content').offsetHeight);
    if (!(h1 < h0 * 0.5)) bad(`${w}px collapse all did not shrink content: ${h0} -> ${h1}`);
    // diagram step, glossary, search
    await pg.goto(URL + '#/l09/s4'); await pg.reload();
    // home map: click a term
    await pg.goto(URL + '#/'); await pg.reload();
    await pg.locator('.term').first().dispatchEvent('pointerdown'); await pg.locator('.term').first().dispatchEvent('pointerup');
    if (await pg.locator('#pop').isHidden()) bad(`${w}px home: term popover did not open`);
    await pg.keyboard.press('/'); await pg.keyboard.type('shuffle');
    const nres = await pg.locator('#results a').count();
    if (nres < 3) bad(`${w}px search: only ${nres} results`);
    await check(`${w}px home`);
    await pg.keyboard.press('Escape');
    // tabs: each visible + clickable, track tab is exclusive (own sidebar, own prev/next chain)
    const tracks = await pg.evaluate(() => window.DATA.tracks.map((t) => ({ id: t.id, secs: t.sections.map((s) => s.id) })));
    if (tracks.length !== 2) bad(`${w}px expected 2 tracks, got ${tracks.length}`);
    const tb = await pg.evaluate(() => { const t = document.querySelector('#tabs'); return [t.scrollWidth, t.clientWidth]; });
    if (tb[0] > tb[1]) bad(`${w}px tab bar clipped: scrollWidth ${tb[0]} > clientWidth ${tb[1]}`);
    for (const t of tracks) {
      await pg.goto(URL + '#/'); await pg.reload();
      const tab = pg.locator(`#tabs a[data-t="${t.id}"]`);
      const bb = await tab.boundingBox();
      if (!bb || bb.x < 0 || bb.x + bb.width > w) bad(`${w}px tab ${t.id} not fully visible: ${JSON.stringify(bb)}`);
      await tab.click();
      await pg.waitForFunction((id) => location.hash.startsWith('#/' + id + '/'), t.id);
      const st = await pg.evaluate(() => ({ on: [...document.querySelectorAll('#tabs a.on')].map((a) => a.dataset.t), nl: document.querySelectorAll('#side .nl').length, si: document.querySelectorAll('#side a.si').length }));
      if (st.on.join() !== t.id) bad(`${w}px tab ${t.id}: active tabs ${st.on}`);
      if (st.nl !== 1 || st.si !== t.secs.length) bad(`${w}px tab ${t.id}: sidebar not exclusive nl=${st.nl} si=${st.si}/${t.secs.length}`);
      for (const [i, s] of t.secs.entries()) {
        await pg.goto(URL + `#/${t.id}/${s}`);
        const nav = await pg.evaluate(() => [...document.querySelectorAll('.nav2 a')].map((a) => a.getAttribute('href')));
        if (nav.some((h) => !h.startsWith(`#/${t.id}/`))) bad(`${w}px ${t.id}/${s}: prev/next leaves track ${nav}`);
        if (nav.length !== (i === 0 || i === t.secs.length - 1 ? 1 : 2)) bad(`${w}px ${t.id}/${s}: ${nav.length} nav links`);
        await check(`${w}px ${t.id}/${s}`);
      }
      // lectures tab returns to the map
      await pg.locator('#tabs a[data-t="lec"]').click();
      if (!(await pg.waitForSelector('#map', { timeout: 3000 }).catch(() => null))) bad(`${w}px lectures tab did not return home`);
    }
    if (errs.length) bad(`${w}px page errors: ${[...new Set(errs)].slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  await br.close();
  console.log(fails.length ? `${fails.length} failure(s)` : 'UI PASS');
  process.exit(fails.length ? 1 : 0);
})();
