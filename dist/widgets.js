// Interactive labs. Each lab is tied to a lecture section; logic lives in lib.js.
(function () {
  const L = window.LIB;
  const NS = 'http://www.w3.org/2000/svg';
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v);
    });
    kids.flat().forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  }
  function s(tag, props, ...kids) {
    const e = document.createElementNS(NS, tag);
    Object.entries(props || {}).forEach(([k, v]) => e.setAttribute(k, v));
    kids.flat().forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  }
  const pct = (v) => (v === null ? 'n/a' : (v * 100).toFixed(1) + '%');
  function slider(label, min, max, val, step, on) {
    const out = h('b', {}, String(val));
    const inp = h('input', { type: 'range', min, max, step: step || 1, value: val });
    inp.addEventListener('input', () => { out.textContent = inp.value; on(Number(inp.value)); });
    return h('label', {}, label, inp, out);
  }
  function toggles(options, cur, on) {
    const wrap = h('span', {});
    const btns = options.map(([v, label]) => h('button', { class: 'b' + (v === cur ? ' on' : ''), onclick: () => { cur = v; btns.forEach((b, i) => b.classList.toggle('on', options[i][0] === v)); on(v); } }, label));
    wrap.append(...btns);
    return wrap;
  }

  const W = [];

  // ================= 08 / section 5: partitions and buckets =================
  W.push({
    lec: 'l08', n: 5, title: 'Partition and bucket explorer',
    sub: 'Partition = directory on HDFS. Bucket = file inside it. Change the layout, then filter and see which directories Hive has to read.',
    mount(root) {
      const G = ['F', 'M'], C = ['shoes', 'shirt', 'bag'], K = ['red', 'blue', 'black'];
      const rnd = L.rng(11);
      const rows = [];
      for (let i = 0; i < 36; i++) rows.push({ product_id: 'p' + (100 + i), gender: G[Math.floor(rnd() * 2)], category: C[Math.floor(rnd() * 3)], color: K[Math.floor(rnd() * 3)], price: Math.round(10 + rnd() * 90) });
      const st = { part: ['gender'], buckets: 0, f: { gender: '', category: '', color: '' } };
      const ctl = h('div', { class: 'ctl' });
      ['gender', 'category', 'color'].forEach((c) => {
        const cb = h('input', { type: 'checkbox' }); cb.checked = st.part.includes(c);
        cb.onchange = () => { st.part = ['gender', 'category', 'color'].filter((x) => (x === c ? cb.checked : st.part.includes(x))); draw(); };
        ctl.append(h('label', {}, cb, 'PARTITIONED BY ' + c));
      });
      ctl.append(slider('CLUSTERED BY (price) INTO', 0, 8, 0, 1, (v) => { st.buckets = v; draw(); }), h('span', {}, 'buckets (0 = none)'));
      const fl = h('div', { class: 'ctl' }, h('b', {}, 'WHERE'));
      [['gender', G], ['category', C], ['color', K]].forEach(([c, vs]) => {
        const sel = h('select', {}, h('option', { value: '' }, c + ' = any'), vs.map((v) => h('option', { value: v }, c + " = '" + v + "'")));
        sel.onchange = () => { st.f[c] = sel.value; draw(); };
        fl.append(sel);
      });
      const sql = h('div', { class: 'out' }), tree = h('div', { class: 'tree out' }), stat = h('div', { class: 'note' });
      root.append(ctl, fl, sql, tree, stat);
      function draw() {
        const ddl = 'CREATE TABLE products (...)' + (st.part.length ? '\nPARTITIONED BY (' + st.part.join(', ') + ')' : '') + (st.buckets ? '\nCLUSTERED BY (price) INTO ' + st.buckets + ' BUCKETS' : '');
        const w = Object.entries(st.f).filter(([, v]) => v).map(([k, v]) => `${k} = '${v}'`);
        sql.textContent = ddl + ';\nSELECT * FROM products' + (w.length ? '\nWHERE ' + w.join(' AND ') : '') + ';';
        const dirs = L.prune(L.layout(rows, st.part, st.buckets ? 'price' : null, st.buckets), st.part, st.f);
        tree.innerHTML = '';
        let scanned = 0, scannedRows = 0, nonPart = Object.entries(st.f).filter(([k, v]) => v && !st.part.includes(k)).length;
        tree.append('/user/hive/warehouse/products/\n');
        dirs.forEach((d) => {
          if (d.scan) { scanned++; scannedRows += d.rows; }
          const files = Object.entries(d.files).sort().map(([f, n]) => `${f} (${n})`).join('  ');
          tree.append(h('div', { class: d.scan ? 'hit' : 'skip' }, `  ${d.dir === '(table root)' ? '.' : d.dir}/   ${d.rows} rows${d.scan ? '' : '   (skipped: pruned)'}\n      ${files}`));
        });
        stat.textContent = `Reads ${scanned} of ${dirs.length} directories, ${scannedRows} of ${rows.length} rows.` + (nonPart ? ' A filter on a non-partition column cannot prune directories; Hive has no index, so it still scans them.' : '');
      }
      draw();
    },
  });

  // ================= 08 / section 7: window functions =================
  W.push({
    lec: 'l08', n: 7, title: 'Window function playground',
    sub: 'A window function returns one value per input row. PARTITION BY picks the group, ORDER BY the order inside it.',
    mount(root) {
      const films = [
        { id: 1, year: 2015, rating: 9.0 }, { id: 2, year: 2015, rating: 8.0 },
        { id: 3, year: 2016, rating: 8.8 }, { id: 4, year: 2016, rating: 8.1 }, { id: 5, year: 2016, rating: 8.0 },
        { id: 6, year: 2017, rating: 7.5 }, { id: 7, year: 2017, rating: 6.5 },
      ];
      const st = { fn: 'avg', part: true };
      const sqlBox = h('div', { class: 'out' }), tbl = h('div', {});
      const names = { avg: 'AVG(rating)', rank: 'RANK()', row_number: 'ROW_NUMBER()', lag: 'LAG(rating, 1, 0)', lead: 'LEAD(rating, 1, 0)' };
      root.append(h('div', { class: 'ctl' },
        toggles(Object.keys(names).map((k) => [k, names[k]]), 'avg', (v) => { st.fn = v; draw(); }),
        toggles([[true, 'PARTITION BY year'], [false, 'no partition (all rows)']], true, (v) => { st.part = v; draw(); })), sqlBox, tbl);
      function draw() {
        const ord = st.fn === 'lag' || st.fn === 'lead';
        const over = (st.part ? 'PARTITION BY year ' : '') + (st.fn === 'avg' ? '' : 'ORDER BY rating DESC');
        sqlBox.textContent = `SELECT id, year, rating,\n       ${names[st.fn]} OVER (${over.trim()}) AS result\nFROM films;`;
        const res = L.windowFn(films, { partitionBy: st.part ? 'year' : null, orderBy: 'rating', desc: true });
        const t = h('table', { class: 'mini' }, h('tr', {}, ['id', 'year', 'rating', 'result'].map((c) => h('th', {}, c))));
        res.forEach((r, i) => {
          const v = r[st.fn];
          const newGroup = st.part && i > 0 && res[i - 1].year !== r.year;
          t.append(h('tr', { style: newGroup ? 'border-top:3px solid var(--c)' : '' }, [r.id, r.year, r.rating.toFixed(1), typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : v].map((c) => h('td', {}, String(c)))));
        });
        tbl.innerHTML = ''; tbl.append(t, h('div', { class: 'note' }, st.fn === 'avg' ? 'Every row keeps its identity (unlike GROUP BY) and gains its group average: 2015 is 8.5, 2016 is 8.3, 2017 is 7.0.' : st.fn.match(/lag|lead/) ? 'The third argument is the default (0) used at the group edge where no neighbour exists.' : 'Ranking restarts in each partition. With no partition the whole table is one window.'));
      }
      draw();
    },
  });

  // ================= 09 / section 4: partitions, slots, waves =================
  W.push({
    lec: 'l09', n: 4, title: 'Partitions, slots and waves',
    sub: 'One task per partition. Tasks only run as fast as there are free slots. Default is the lecture case: 1,000,000 records in 4 partitions, 2 slots.',
    mount(root) {
      const st = { p: 4, k: 2, skew: false };
      const out = h('div', { class: 'out' }), svg = s('svg', { viewBox: '0 0 700 200' });
      root.append(h('div', { class: 'ctl' }, slider('partitions', 1, 12, 4, 1, (v) => { st.p = v; draw(); }), slider('slots (cores)', 1, 8, 2, 1, (v) => { st.k = v; draw(); }),
        h('label', {}, h('input', { type: 'checkbox', onchange: (e) => { st.skew = e.target.checked; draw(); } }), 'make P1 three times bigger (skew)')), svg, out);
      function draw() {
        const d = Array.from({ length: st.p }, (_, i) => (st.skew && i === 0 ? 3 : 1));
        const sc = L.schedule(d, st.k);
        svg.innerHTML = '';
        const W0 = 640, x0 = 50, lh = Math.min(34, 170 / st.k), unit = W0 / sc.makespan;
        sc.lanes.forEach((lane, i) => {
          svg.append(s('text', { x: 4, y: 20 + i * (lh + 4) + lh / 2 }, 'slot ' + (i + 1)));
          lane.forEach((t) => {
            const wave = Math.floor((t.p - 1) / st.k) + 1;
            svg.append(s('rect', { x: x0 + t.start * unit, y: 14 + i * (lh + 4), width: (t.end - t.start) * unit - 2, height: lh, rx: 5, fill: 'var(--c)', opacity: 1 - 0.18 * (wave - 1) }),
              s('text', { x: x0 + t.start * unit + 8, y: 14 + i * (lh + 4) + lh / 2 + 4, fill: '#fff', style: 'fill:#fff' }, 'P' + t.p));
          });
        });
        const allAtOnce = st.p <= st.k;
        out.textContent = `Waves = ceil(${st.p} / ${st.k}) = ${sc.waves}   |   makespan = ${sc.makespan} time units\nCan all ${st.p} tasks run at the same time? ${allAtOnce ? 'YES' : 'NO'}` + (st.skew ? '\nSkew: the slot holding P1 is the bottleneck, other slots sit idle at the end.' : '');
      }
      draw();
    },
  });

  // ================= 09 / sections 9-10: lazy lineage and stages =================
  W.push({
    lec: 'l09', n: 9, title: 'Lazy lineage builder',
    sub: 'Add transformations: Spark only records a plan. Add an action and the DAG is cut into stages at every wide (shuffle) dependency.',
    mount(root) {
      const st = { ops: ['textFile', 'flatMap', 'map', 'reduceByKey', 'saveAsTextFile'], ran: false };
      const stage = h('div', {}), msg = h('div', { class: 'out' });
      const add = (o) => { st.ops.push(o); st.ran = false; draw(); };
      const row = (arr) => h('span', {}, arr.map((o) => h('button', { class: 'b', onclick: () => add(o) }, o + '()')));
      root.append(h('div', { class: 'ctl' }, h('b', {}, 'narrow:'), row(['map', 'filter', 'flatMap']), h('b', {}, 'wide:'), row(['reduceByKey', 'groupByKey', 'join']), h('b', {}, 'action:'), row(['count', 'collect', 'saveAsTextFile']),
        h('button', { class: 'b', onclick: () => { st.ops = ['textFile']; st.ran = false; draw(); } }, 'reset'), h('button', { class: 'b', onclick: () => { st.ran = true; draw(); } }, 'run')), stage, msg);
      function draw() {
        const act = L.hasAction(st.ops);
        const stages = L.stages(st.ops);
        stage.innerHTML = '';
        const wrap = h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:stretch;margin:10px 0' });
        stages.forEach((ops, i) => {
          const box = h('div', { style: `border:2px ${act ? 'solid' : 'dashed'} var(--c);border-radius:10px;padding:8px 10px;opacity:${act && !st.ran ? 1 : act ? 1 : 0.55}` },
            h('div', { class: 'note', style: 'margin:0 0 4px' }, act ? 'Stage ' + (i + 1) + ' (' + ops.length + ' pipelined)' : 'plan only'),
            h('div', { style: 'display:flex;gap:4px;flex-wrap:wrap' }, ops.map((o) => h('span', { style: `padding:2px 8px;border-radius:99px;font-size:13px;color:#fff;background:${L.ACTIONS.includes(o) ? '#c2255c' : L.WIDE.includes(o) ? '#e8590c' : o === 'textFile' ? '#868e96' : '#2f6fed'}` }, o))));
          wrap.append(box);
          if (i < stages.length - 1) wrap.append(h('div', { style: 'align-self:center;font-size:12px;color:var(--acc2)', html: 'shuffle<br>&rarr;' }));
        });
        stage.append(wrap, h('div', { class: 'note' }, 'blue = narrow (1 parent partition), orange = wide (all-to-all shuffle), pink = action, grey = source'));
        const wide = st.ops.filter((o) => L.WIDE.includes(o)).length;
        msg.textContent = !act ? `No action yet: ${st.ops.length - 1} transformation(s) recorded, 0 records processed. Nothing runs.` : `Action present -> 1 job. ${wide} wide op(s) -> ${stages.length} stage(s). ` + (st.ran ? 'Job executed.' : 'Press run.');
        if (st.ran && !act) msg.textContent = 'Press an action first: transformations alone never trigger a job.';
      }
      draw();
    },
  });

  // ================= 10 / section 15: event-time windows =================
  W.push({
    lec: 'l10', n: 15, title: 'Windows on event time',
    sub: 'Events can arrive late. Click the timeline to add events. The red event happened at 8s but arrived at 15s. Switch the clock to see how the grouping changes.',
    mount(root) {
      const st = { kind: 'tumbling', size: 10, slide: 5, gap: 5, key: 'event', ev: [{ event: 2, arrive: 2 }, { event: 4, arrive: 5 }, { event: 8, arrive: 15, late: true }, { event: 12, arrive: 12 }, { event: 17, arrive: 18 }, { event: 27, arrive: 27 }, { event: 29, arrive: 31 }] };
      const svg = s('svg', { viewBox: '0 0 720 300' }), note = h('div', { class: 'note' });
      const sl = slider('slide', 1, 10, 5, 1, (v) => { st.slide = v; draw(); });
      root.append(h('div', { class: 'ctl' },
        toggles([['tumbling', 'tumbling'], ['sliding', 'sliding'], ['session', 'session']], 'tumbling', (v) => { st.kind = v; draw(); }),
        slider('size / gap (s)', 2, 20, 10, 1, (v) => { st.size = v; st.gap = Math.max(2, Math.round(v / 2)); draw(); }), sl,
        toggles([['event', 'group by event time'], ['arrive', 'group by processing time']], 'event', (v) => { st.key = v; draw(); }),
        h('button', { class: 'b', onclick: () => { st.ev.length = 0; draw(); } }, 'clear')), svg, note);
      const X = (t) => 30 + t * 17.5;
      svg.addEventListener('click', (e) => {
        const r = svg.getBoundingClientRect(); const t = Math.round(((e.clientX - r.left) / r.width * 720 - 30) / 17.5);
        if (t >= 0 && t <= 38) { st.ev.push({ event: t, arrive: t }); draw(); }
      });
      function draw() {
        svg.innerHTML = '';
        const key = st.key, size = st.size, slide = Math.min(st.slide, size);
        for (let t = 0; t <= 40; t += 5) svg.append(s('line', { x1: X(t), x2: X(t), y1: 250, y2: 256, stroke: 'currentColor' }), s('text', { x: X(t) - 6, y: 272 }, t + 's'));
        svg.append(s('line', { x1: 30, x2: 700, y1: 250, y2: 250, stroke: 'currentColor' }));
        let wins = [];
        if (st.kind === 'session') wins = L.sessions(st.ev.map((e) => e[key]), st.gap).map((w) => ({ start: w.start, end: w.end, n: w.n }));
        else {
          const m = L.countWindows(st.ev, key, size, st.kind === 'sliding' ? slide : size);
          wins = Object.keys(m).map(Number).sort((a, b) => a - b).map((w) => ({ start: w, end: w + size, n: m[w] }));
        }
        wins.slice(0, 12).forEach((w, i) => {
          const y = 12 + i * 19;
          svg.append(s('rect', { x: X(w.start), y, width: Math.max(2, (Math.min(w.end, 40) - w.start) * 17.5), height: 15, rx: 4, fill: 'var(--c)', opacity: 0.35 }),
            s('text', { x: X(w.start) + 4, y: y + 12 }, `[${w.start},${w.end}) count=${w.n}`));
        });
        st.ev.forEach((e) => {
          svg.append(s('circle', { cx: X(e[key]), cy: 238, r: 6, fill: e.late ? '#e03131' : 'var(--c)' }));
          if (e.arrive !== e.event && key === 'event') svg.append(s('line', { x1: X(e.event), x2: X(e.arrive), y1: 238, y2: 238, stroke: '#e03131', 'stroke-dasharray': '3 3' }));
        });
        const lateEv = st.ev.find((e) => e.late);
        const ew = lateEv ? (L.tumbling(lateEv.event, size)[0]) : null, aw = lateEv ? (L.tumbling(lateEv.arrive, size)[0]) : null;
        note.textContent = st.kind === 'session' ? `Session window: a new session starts after ${st.gap}s of inactivity; size is dynamic. Raise or lower the gap to merge or split sessions.`
          : st.kind === 'sliding' ? `Sliding: window ${size}s, slide ${slide}s. One event can fall in ${Math.ceil(size / slide)} overlapping windows.`
          : 'Tumbling: fixed size, non-overlapping, each event belongs to exactly one window.';
        if (lateEv && st.kind === 'tumbling') note.textContent += `  The late event lands in [${ew},${ew + size}) by event time but [${aw},${aw + size}) by processing time.`;
      }
      draw();
    },
  });

  // ================= 11 / section 4: confusion matrix and threshold =================
  W.push({
    lec: 'l11', n: 4, title: 'Threshold, confusion matrix and the accuracy trap',
    sub: 'The lecture example: 1,000 insurance claims, 20 fraud (2%). Slide the decision threshold and watch each metric move.',
    mount(root) {
      const D = L.fraudData();
      const st = { thr: 0.5 };
      const svg = s('svg', { viewBox: '0 0 720 170' }), cm = h('div', {}), bars = h('div', {}), note = h('div', { class: 'note' });
      const sl = slider('threshold', 0, 100, 50, 1, (v) => { st.thr = v / 100; draw(); });
      root.append(h('div', { class: 'ctl' }, sl, h('button', { class: 'b', onclick: () => { sl.querySelector('input').value = 100; sl.querySelector('b').textContent = 100; st.thr = 1.01; draw(); } }, 'predict everything legitimate'),
        h('button', { class: 'b', onclick: () => { sl.querySelector('input').value = 0; sl.querySelector('b').textContent = 0; st.thr = 0; draw(); } }, 'flag everything')), svg,
        h('div', { style: 'display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:start' }, cm, bars), note);
      const bins = 40, hist = [new Array(bins).fill(0), new Array(bins).fill(0)];
      D.scores.forEach((v, i) => { hist[D.labels[i]][Math.min(bins - 1, Math.floor(v * bins))]++; });
      function draw() {
        svg.innerHTML = '';
        const mx = Math.max(...hist[0].map((v) => Math.sqrt(v)));
        [0, 1].forEach((c) => hist[c].forEach((v, i) => {
          const hh = c ? v * 14 : Math.sqrt(v) / mx * 120;
          svg.append(s('rect', { x: 20 + i * 17, y: 140 - hh, width: 15, height: hh, fill: c ? '#e03131' : 'var(--c)', opacity: c ? 0.9 : 0.4 }));
        }));
        svg.append(s('line', { x1: 20 + st.thr * 680, x2: 20 + st.thr * 680, y1: 5, y2: 145, stroke: 'currentColor', 'stroke-width': 2 }), s('text', { x: 24, y: 162 }, 'score 0'), s('text', { x: 660, y: 162 }, 'score 1'),
          s('text', { x: 400, y: 14, fill: '#e03131', style: 'fill:#e03131' }, 'red = fraud (20), blue = legitimate (980, sqrt scale)'));
        const c = L.confusion(D.scores, D.labels, st.thr), m = L.metrics(c);
        cm.innerHTML = '';
        cm.append(h('table', { class: 'mini' },
          h('tr', {}, h('th', {}, ''), h('th', {}, 'Actual +'), h('th', {}, 'Actual -')),
          h('tr', {}, h('th', {}, 'Predicted +'), h('td', {}, 'TP ' + c.tp), h('td', {}, 'FP ' + c.fp)),
          h('tr', {}, h('th', {}, 'Predicted -'), h('td', {}, 'FN ' + c.fn), h('td', {}, 'TN ' + c.tn))));
        bars.innerHTML = '';
        [['Accuracy', m.accuracy], ['Precision', m.precision], ['Recall', m.recall], ['F1', m.f1]].forEach(([k, v]) => bars.append(h('div', { style: 'display:flex;gap:8px;align-items:center;font-size:13px;margin:3px 0' }, h('span', { style: 'width:70px' }, k), h('div', { class: 'bar', style: 'flex:1;margin:0;--c:var(--c)' }, h('i', { style: 'width:' + (v === null ? 0 : v * 100) + '%' })), h('span', { style: 'width:60px' }, pct(v)))));
        note.textContent = m.recall === 0 ? `Accuracy ${pct(m.accuracy)} while catching 0 of 20 frauds: the accuracy trap on imbalanced data.` : 'Lower the threshold: recall rises, precision falls (more false alarms). Raise it: the opposite. Fraud and medical detection usually favour recall.';
      }
      draw();
    },
  });

  // ================= 11 / section 5: under/overfitting =================
  W.push({
    lec: 'l11', n: 5, title: 'Underfitting vs overfitting',
    sub: 'Fit a polynomial of growing complexity to 12 training points. Training error only falls; validation error is U-shaped.',
    mount(root) {
      const r = L.rng(3), f = (x) => Math.sin(2.2 * x);
      const mk = (n) => Array.from({ length: n }, () => { const x = r() * 2 - 1; return [x, f(x) + 0.25 * L.gauss(r)]; });
      const tr = mk(12), va = mk(40);
      const st = { deg: 1 };
      const svg = s('svg', { viewBox: '0 0 720 260' }), out = h('div', { class: 'out' });
      root.append(h('div', { class: 'ctl' }, slider('model complexity (polynomial degree)', 1, 9, 1, 1, (v) => { st.deg = v; draw(); })), svg, out);
      const errs = [];
      for (let d = 1; d <= 9; d++) {
        const w = L.polyfit(tr.map((p) => p[0]), tr.map((p) => p[1]), d, 1e-7);
        errs.push([L.mse(tr.map((p) => p[1]), tr.map((p) => L.polyval(w, p[0]))), L.mse(va.map((p) => p[1]), va.map((p) => L.polyval(w, p[0])))]);
      }
      const clamp = (v) => Math.max(-2, Math.min(2, v));
      function draw() {
        svg.innerHTML = '';
        const X = (x) => 20 + (x + 1) * 160, Y = (y) => 125 - clamp(y) * 55;
        svg.append(s('rect', { x: 20, y: 5, width: 320, height: 240, fill: 'none', stroke: 'currentColor', opacity: 0.2 }));
        let dpath = ''; for (let i = 0; i <= 100; i++) { const x = -1 + i / 50; dpath += (i ? 'L' : 'M') + X(x) + ' ' + Y(f(x)); }
        svg.append(s('path', { d: dpath, fill: 'none', stroke: '#868e96', 'stroke-dasharray': '4 4' }));
        const w = L.polyfit(tr.map((p) => p[0]), tr.map((p) => p[1]), st.deg, 1e-7);
        let path = ''; for (let i = 0; i <= 100; i++) { const x = -1 + i / 50; path += (i ? 'L' : 'M') + X(x) + ' ' + Y(L.polyval(w, x)); }
        svg.append(s('path', { d: path, fill: 'none', stroke: 'var(--c)', 'stroke-width': 2.5 }));
        va.forEach((p) => svg.append(s('circle', { cx: X(p[0]), cy: Y(p[1]), r: 2.5, fill: '#868e96', opacity: 0.5 })));
        tr.forEach((p) => svg.append(s('circle', { cx: X(p[0]), cy: Y(p[1]), r: 5, fill: '#e03131' })));
        svg.append(s('text', { x: 24, y: 20 }, 'red = training, grey = unseen, dashed = truth'));
        const mxE = Math.max(...errs.flat().map((v) => Math.min(v, 0.6)));
        const EX = (d) => 380 + (d - 1) * 40, EY = (v) => 240 - Math.min(v, 0.6) / mxE * 220;
        [0, 1].forEach((k) => svg.append(s('path', { d: errs.map((e, i) => (i ? 'L' : 'M') + EX(i + 1) + ' ' + EY(e[k])).join(' '), fill: 'none', stroke: k ? '#e8590c' : '#2f6fed', 'stroke-width': 2 })));
        svg.append(s('circle', { cx: EX(st.deg), cy: EY(errs[st.deg - 1][0]), r: 5, fill: '#2f6fed' }), s('circle', { cx: EX(st.deg), cy: EY(errs[st.deg - 1][1]), r: 5, fill: '#e8590c' }),
          s('text', { x: 380, y: 14 }, 'blue = training error, orange = validation error'), s('text', { x: 560, y: 256 }, 'complexity'));
        const [a, b] = errs[st.deg - 1];
        out.textContent = `degree ${st.deg}: training MSE ${a.toFixed(3)} | validation MSE ${b.toFixed(3)}\n` + (b > a * 3 && st.deg > 4 ? 'Training loss << validation loss: overfitting.' : st.deg <= 2 ? 'Poor on both sets: underfitting (too simple).' : 'Close to the best generalisation (lowest validation error).');
      }
      draw();
    },
  });

  // ================= 12 / section 3: chart chooser =================
  W.push({
    lec: 'l12', n: 3, title: 'Question to chart',
    sub: 'Pick the analytical question you are asking. The matching charts are drawn from sample data.',
    mount(root) {
      const A = [
        ['Descriptive', 'What happened?', ['histogram', 'bar', 'pie']], ['Diagnostic', 'Why did it happen?', ['scatter', 'heatmap', 'box']],
        ['Trend', 'How is it changing?', ['line', 'area']], ['Predictive', 'What is likely to happen?', ['forecast']],
        ['Comparative', 'How do these compare?', ['grouped', 'multiline']], ['Correlation', 'What moves together?', ['scatter', 'heatmap']],
        ['Distribution', 'How is it spread?', ['histogram', 'violin']], ['Geospatial', 'Where is it happening?', ['bubble']],
      ];
      const r = L.rng(5), data = Array.from({ length: 12 }, (_, i) => 20 + 12 * Math.sin(i / 2) + r() * 10);
      const draws = {
        histogram: (g) => [3, 6, 11, 16, 12, 8, 4, 2].forEach((v, i) => g.append(s('rect', { x: 6 + i * 20, y: 90 - v * 5, width: 18, height: v * 5, fill: 'var(--c)' }))),
        bar: (g) => [40, 65, 30, 55].forEach((v, i) => g.append(s('rect', { x: 14 + i * 38, y: 95 - v, width: 28, height: v, fill: 'var(--c)' }))),
        pie: (g) => { let a = 0; [0.4, 0.3, 0.2, 0.1].forEach((v, i) => { const a2 = a + v * 2 * Math.PI, p = (t) => [80 + 40 * Math.cos(t), 50 + 40 * Math.sin(t)]; g.append(s('path', { d: `M80 50 L${p(a)} A40 40 0 ${v > 0.5 ? 1 : 0} 1 ${p(a2)} Z`, fill: ['#2f6fed', '#e8590c', '#2b8a3e', '#7048e8'][i] })); a = a2; }); },
        scatter: (g) => data.forEach((v, i) => g.append(s('circle', { cx: 12 + i * 12, cy: 95 - v * 1.6 - r() * 8, r: 3.5, fill: 'var(--c)' }))),
        heatmap: (g) => { for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) g.append(s('rect', { x: 14 + i * 22, y: 10 + j * 17, width: 20, height: 15, fill: 'var(--c)', opacity: 0.15 + 0.85 * r() })); },
        box: (g) => [[30, 50, 70], [20, 40, 60], [45, 60, 85]].forEach(([a, b, c], i) => g.append(s('line', { x1: 30 + i * 45, x2: 30 + i * 45, y1: 100 - c - 8, y2: 100 - a + 8, stroke: 'currentColor' }), s('rect', { x: 18 + i * 45, y: 100 - c, width: 24, height: c - a, fill: 'var(--c)', opacity: 0.6, stroke: 'currentColor' }), s('circle', { cx: 30 + i * 45, cy: 100 - c - 16, r: 2.5, fill: '#e03131' }))),
        line: (g) => g.append(s('path', { d: data.map((v, i) => (i ? 'L' : 'M') + (10 + i * 13) + ' ' + (100 - v * 1.8)).join(' '), fill: 'none', stroke: 'var(--c)', 'stroke-width': 2.5 })),
        area: (g) => g.append(s('path', { d: 'M10 100 ' + data.map((v, i) => 'L' + (10 + i * 13) + ' ' + (100 - v * 1.8)).join(' ') + ' L153 100 Z', fill: 'var(--c)', opacity: 0.5 })),
        forecast: (g) => { g.append(s('path', { d: 'M10 80 L40 70 L70 60 L100 52', fill: 'none', stroke: 'var(--c)', 'stroke-width': 2.5 }), s('path', { d: 'M100 52 L150 30 L150 62 Z', fill: 'var(--c)', opacity: 0.25 }), s('path', { d: 'M100 52 L150 46', stroke: 'var(--c)', 'stroke-dasharray': '4 3', fill: 'none', 'stroke-width': 2 })); },
        grouped: (g) => [[30, 45], [55, 40], [35, 60]].forEach(([a, b], i) => g.append(s('rect', { x: 14 + i * 48, y: 95 - a, width: 18, height: a, fill: 'var(--c)' }), s('rect', { x: 33 + i * 48, y: 95 - b, width: 18, height: b, fill: '#e8590c' }))),
        multiline: (g) => { [0, 1, 2].forEach((k) => g.append(s('path', { d: data.map((v, i) => (i ? 'L' : 'M') + (10 + i * 13) + ' ' + (100 - (v + k * 12 - 10 + Math.sin(i + k) * 4) * 1.5)).join(' '), fill: 'none', stroke: ['#2f6fed', '#e8590c', '#2b8a3e'][k], 'stroke-width': 2 }))); },
        violin: (g) => [0, 1].forEach((i) => g.append(s('path', { d: `M${45 + i * 70} 10 C${75 + i * 70} 30 ${75 + i * 70} 70 ${45 + i * 70} 95 C${15 + i * 70} 70 ${15 + i * 70} 30 ${45 + i * 70} 10 Z`, fill: 'var(--c)', opacity: 0.55 }))),
        bubble: (g) => [[40, 40, 14], [90, 55, 22], [125, 30, 9], [60, 75, 11]].forEach(([x, y, rr]) => g.append(s('circle', { cx: x, cy: y, r: rr, fill: 'var(--c)', opacity: 0.55 }))),
      };
      const out = h('div', { style: 'display:flex;gap:12px;flex-wrap:wrap;margin-top:8px' });
      const q = h('div', { class: 'ctl' });
      const btns = A.map((a, i) => h('button', { class: 'b', onclick: () => pick(i) }, a[1]));
      q.append(...btns); root.append(q, out);
      function pick(i) {
        btns.forEach((b, j) => b.classList.toggle('on', i === j));
        out.innerHTML = '';
        out.append(h('div', { style: 'flex-basis:100%;font-size:14px' }, h('b', {}, A[i][0] + ' analysis'), ' asks "' + A[i][1] + '"'));
        A[i][2].forEach((c) => { const g = s('g', {}); draws[c](g); out.append(h('div', { style: 'text-align:center;border:1px solid var(--line);border-radius:10px;padding:6px;background:var(--bg);width:190px' }, s('svg', { viewBox: '0 0 160 110', style: 'width:100%' }, g), h('div', { class: 'note', style: 'margin:0' }, c))); });
      }
      pick(0);
    },
  });

  window.WIDGETS = W;
})();
