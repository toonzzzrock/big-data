// Pure logic behind the interactive labs (no DOM). Loaded in browser and in node:test.
(function (root) {
  const L = {};

  // ---- Spark I: partitions, slots, waves (lecture 09 section 4.3) ----
  L.schedule = function (durations, slots) {
    const free = new Array(slots).fill(0);
    const lanes = Array.from({ length: slots }, () => []);
    durations.forEach((d, i) => {
      let k = 0;
      for (let j = 1; j < slots; j++) if (free[j] < free[k]) k = j;
      lanes[k].push({ p: i + 1, start: free[k], end: free[k] + d });
      free[k] += d;
    });
    return { lanes, makespan: Math.max(...free), waves: Math.ceil(durations.length / slots) };
  };

  // ---- Spark I: lineage -> stages (lecture 09 sections 4.2, 9.3, 9.5) ----
  L.WIDE = ['reduceByKey', 'groupByKey', 'join', 'sortBy', 'distinct'];
  L.ACTIONS = ['count', 'collect', 'take', 'first', 'reduce', 'saveAsTextFile'];
  L.stages = function (ops) {
    // ops: array of op names. Returns stage list of op-name arrays, split at wide ops (shuffle boundary).
    const out = [[]];
    ops.forEach((o) => {
      if (L.ACTIONS.includes(o)) { out[out.length - 1].push(o); return; }
      if (L.WIDE.includes(o)) out.push([]);
      out[out.length - 1].push(o);
    });
    return out;
  };
  L.hasAction = (ops) => ops.some((o) => L.ACTIONS.includes(o));

  // ---- Spark II: event-time windows (lecture 10 section 15) ----
  L.tumbling = (t, size) => [Math.floor(t / size) * size];
  L.sliding = function (t, size, slide) {
    const out = [];
    for (let s = Math.floor(t / slide) * slide; s > t - size; s -= slide) if (s >= 0) out.push(s);
    return out.sort((a, b) => a - b);
  };
  L.sessions = function (times, gap) {
    const ts = times.slice().sort((a, b) => a - b);
    const out = [];
    ts.forEach((t) => {
      const last = out[out.length - 1];
      if (last && t < last.end) { last.end = t + gap; last.n++; last.times.push(t); }
      else out.push({ start: t, end: t + gap, n: 1, times: [t] });
    });
    return out;
  };
  // events: [{event, arrive}]; returns map windowStart -> count, by key ('event' | 'arrive')
  L.countWindows = function (events, key, size, slide) {
    const m = {};
    events.forEach((e) => {
      const ws = slide && slide !== size ? L.sliding(e[key], size, slide) : L.tumbling(e[key], size);
      ws.forEach((w) => { m[w] = (m[w] || 0) + 1; });
    });
    return m;
  };

  // ---- ML: confusion matrix and metrics (lecture 11 section 4.2) ----
  L.confusion = function (scores, labels, thr) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    scores.forEach((s, i) => {
      const pred = s >= thr;
      if (pred && labels[i]) tp++; else if (pred) fp++; else if (labels[i]) fn++; else tn++;
    });
    return { tp, fp, fn, tn };
  };
  L.metrics = function (c) {
    const div = (a, b) => (b === 0 ? null : a / b);
    const precision = div(c.tp, c.tp + c.fp);
    const recall = div(c.tp, c.tp + c.fn);
    const accuracy = div(c.tp + c.tn, c.tp + c.tn + c.fp + c.fn);
    const f1 = precision === null || recall === null || precision + recall === 0 ? null : (2 * precision * recall) / (precision + recall);
    return { precision, recall, accuracy, f1 };
  };
  L.rng = function (seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  };
  L.gauss = function (r) {
    const u = Math.max(r(), 1e-9), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  // 1,000 claims, 20 fraud (2 percent): the lecture's insurance example
  L.fraudData = function (n = 1000, fraud = 20, sep = 3.0) {
    const r = L.rng(7);
    const scores = [], labels = [];
    for (let i = 0; i < n; i++) {
      const f = i < fraud;
      const raw = (f ? sep : 0) + L.gauss(r);
      scores.push(1 / (1 + Math.exp(-(raw - 1.8))));
      labels.push(f ? 1 : 0);
    }
    return { scores, labels };
  };

  // ---- ML: polynomial fit for under/overfitting (lecture 11 section 5) ----
  // least squares via modified Gram-Schmidt on the Vandermonde matrix (stable for high degree)
  L.polyfit = function (xs, ys, deg) {
    const n = deg + 1, m = xs.length;
    const Q = Array.from({ length: n }, (_, j) => xs.map((x) => Math.pow(x, j)));
    const R = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < j; i++) {
        R[i][j] = Q[i].reduce((t, v, k) => t + v * Q[j][k], 0);
        for (let k = 0; k < m; k++) Q[j][k] -= R[i][j] * Q[i][k];
      }
      R[j][j] = Math.sqrt(Q[j].reduce((t, v) => t + v * v, 0)) || 1e-12;
      for (let k = 0; k < m; k++) Q[j][k] /= R[j][j];
    }
    const qty = Q.map((q) => q.reduce((t, v, k) => t + v * ys[k], 0));
    const w = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let t = qty[i];
      for (let j = i + 1; j < n; j++) t -= R[i][j] * w[j];
      w[i] = t / R[i][i];
    }
    return w;
  };
  L.polyval = (w, x) => w.reduce((s, c, i) => s + c * Math.pow(x, i), 0);
  L.mse = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length;
  L.r2 = function (y, yh) {
    const m = y.reduce((s, v) => s + v, 0) / y.length;
    const tot = y.reduce((s, v) => s + (v - m) ** 2, 0);
    const res = y.reduce((s, v, i) => s + (v - yh[i]) ** 2, 0);
    return 1 - res / tot;
  };

  // ---- Hive: partitions and buckets (lecture 08 sections 5.5, 5.6) ----
  L.hash = (v) => { let h = 0; for (const ch of String(v)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  L.layout = function (rows, partCols, bucketCol, nBuckets) {
    const dirs = {};
    rows.forEach((r) => {
      const dir = partCols.length ? partCols.map((c) => `${c}=${r[c]}`).join('/') : '(table root)';
      const d = (dirs[dir] = dirs[dir] || { dir, rows: 0, files: {} });
      d.rows++;
      const f = bucketCol ? `bucket_${String(L.hash(r[bucketCol]) % nBuckets).padStart(2, '0')}` : 'part-00000';
      d.files[f] = (d.files[f] || 0) + 1;
    });
    return Object.values(dirs).sort((a, b) => a.dir.localeCompare(b.dir));
  };
  // which directories a WHERE clause must scan (partition pruning); filter = {col: value}
  L.prune = function (dirs, partCols, filter) {
    return dirs.map((d) => {
      const kv = Object.fromEntries(d.dir.split('/').map((s) => s.split('=')));
      const scan = partCols.every((c) => filter[c] === undefined || filter[c] === '' || String(kv[c]) === String(filter[c]));
      return { ...d, scan };
    });
  };

  // ---- Hive: window functions (lecture 08 section 7) ----
  L.windowFn = function (rows, o) {
    // o: {partitionBy: col|null, orderBy: col, desc: bool}; returns rows plus computed columns
    const key = (r) => (o.partitionBy ? r[o.partitionBy] : '_all');
    const groups = {};
    rows.forEach((r) => { (groups[key(r)] = groups[key(r)] || []).push(r); });
    const out = [];
    Object.keys(groups).forEach((g) => {
      const arr = groups[g].slice().sort((a, b) => (o.desc ? b[o.orderBy] - a[o.orderBy] : a[o.orderBy] - b[o.orderBy]));
      const avg = arr.reduce((s, r) => s + r.rating, 0) / arr.length;
      arr.forEach((r, i) => {
        const rank = 1 + arr.filter((x) => (o.desc ? x[o.orderBy] > r[o.orderBy] : x[o.orderBy] < r[o.orderBy])).length;
        out.push({ ...r, row_number: i + 1, rank, avg: avg, lag: i > 0 ? arr[i - 1].rating : 0, lead: i < arr.length - 1 ? arr[i + 1].rating : 0 });
      });
    });
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
  else root.LIB = L;
})(typeof window !== 'undefined' ? window : globalThis);
