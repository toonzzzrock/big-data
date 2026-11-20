const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/lib.js');

test('09 s4.3: 4 partitions, 2 slots -> 2 waves, P1P2 then P3P4', () => {
  const s = L.schedule([1, 1, 1, 1], 2);
  assert.equal(s.waves, 2);
  assert.deepEqual(s.lanes.map((l) => l.map((t) => t.p)), [[1, 3], [2, 4]]);
  assert.equal(s.makespan, 2);
  assert.equal(L.schedule([1, 1, 1, 1], 4).waves, 1);
  assert.equal(L.schedule(new Array(5).fill(1), 2).waves, 3);
});

test('09 s10: textFile>flatMap>map>reduceByKey>saveAsTextFile = 2 stages', () => {
  const st = L.stages(['textFile', 'flatMap', 'map', 'reduceByKey', 'saveAsTextFile']);
  assert.equal(st.length, 2);
  assert.deepEqual(st[1], ['reduceByKey', 'saveAsTextFile']);
  assert.equal(L.hasAction(['map', 'filter']), false);
});

test('10 s15: tumbling 10s, sliding 10s/5s, session 5s', () => {
  assert.deepEqual(L.tumbling(13, 10), [10]);
  assert.deepEqual(L.sliding(13, 10, 5), [5, 10]);
  assert.deepEqual(L.sliding(2, 10, 5), [0]);
  const s = L.sessions([1, 3, 20, 22], 5);
  assert.equal(s.length, 2);
  assert.equal(s[0].n, 2);
});

test('10 s14: late event lands in event-time window, not arrival window', () => {
  const ev = [{ event: 600, arrive: 780 }]; // 10:00 arrives 10:03 (seconds, 2-minute windows after 10:00 baseline)
  assert.deepEqual(L.countWindows(ev, 'event', 120), { 600: 1 });
  assert.deepEqual(L.countWindows(ev, 'arrive', 120), { 720: 1 });
});

test('11 s4.3: predict-all-legit on 1000 claims, 20 fraud -> 98% accuracy, 0 recall', () => {
  const { scores, labels } = L.fraudData();
  assert.equal(labels.filter(Boolean).length, 20);
  const m = L.metrics(L.confusion(scores, labels, 2)); // threshold above every score
  assert.equal(m.accuracy, 0.98);
  assert.equal(m.recall, 0);
  assert.equal(m.precision, null);
});

test('11 s4.2: formulas', () => {
  const m = L.metrics({ tp: 8, fp: 2, fn: 4, tn: 86 });
  assert.equal(m.precision, 0.8);
  assert.ok(Math.abs(m.recall - 8 / 12) < 1e-12);
  assert.equal(m.accuracy, 0.94);
  assert.ok(Math.abs(m.f1 - (2 * 0.8 * (8 / 12)) / (0.8 + 8 / 12)) < 1e-12);
});

test('11 s4.1: R2 is 1 for perfect fit, 0 for mean predictor', () => {
  assert.equal(L.r2([1, 2, 3], [1, 2, 3]), 1);
  assert.ok(Math.abs(L.r2([1, 2, 3], [2, 2, 2])) < 1e-12);
  assert.ok(L.r2([1, 2, 3], [3, 3, 3]) < 0);
});

test('11 s5: polyfit recovers a line and a quadratic', () => {
  const xs = [-1, -0.5, 0, 0.5, 1];
  const w = L.polyfit(xs, xs.map((x) => 2 * x + 1), 1);
  assert.ok(Math.abs(w[0] - 1) < 1e-6 && Math.abs(w[1] - 2) < 1e-6);
  const w2 = L.polyfit(xs, xs.map((x) => x * x), 2);
  assert.ok(Math.abs(w2[2] - 1) < 1e-6);
});

test('08 s5.5: partition pruning scans only matching directories', () => {
  const rows = [
    { gender: 'M', color: 'red' }, { gender: 'F', color: 'red' }, { gender: 'F', color: 'blue' }, { gender: 'M', color: 'blue' },
  ];
  const dirs = L.layout(rows, ['gender'], null, 0);
  assert.equal(dirs.length, 2);
  const p = L.prune(dirs, ['gender'], { gender: 'F' });
  assert.deepEqual(p.map((d) => d.scan), [true, false].map((x) => x)); // F before M alphabetically
  assert.equal(L.prune(dirs, ['gender'], { color: 'red' }).every((d) => d.scan), true); // non-partition filter prunes nothing
});

test('08 s7: window avg per year matches 8.5 / 8.3 / 7.0; rank and lag', () => {
  const films = [
    { id: 1, year: 2015, rating: 9.0 }, { id: 2, year: 2015, rating: 8.0 },
    { id: 3, year: 2016, rating: 8.8 }, { id: 4, year: 2016, rating: 8.1 }, { id: 5, year: 2016, rating: 8.0 },
    { id: 6, year: 2017, rating: 7.5 }, { id: 7, year: 2017, rating: 6.5 },
  ];
  const r = L.windowFn(films, { partitionBy: 'year', orderBy: 'rating', desc: true });
  const avg = (y) => r.find((x) => x.year === y).avg;
  assert.ok(Math.abs(avg(2015) - 8.5) < 1e-9);
  assert.ok(Math.abs(avg(2016) - 8.3) < 1e-9);
  assert.ok(Math.abs(avg(2017) - 7.0) < 1e-9);
  assert.equal(r.find((x) => x.id === 2).rank, 2);
  assert.equal(r.find((x) => x.id === 1).lag, 0); // default value at the boundary
  const g = L.windowFn(films, { partitionBy: null, orderBy: 'rating', desc: true });
  assert.equal(g.find((x) => x.id === 7).rank, 7);
});

test('11 s4.3: a good fraud model exists at some threshold: >=97% accuracy, most of 20 caught', () => {
  const { scores, labels } = L.fraudData();
  const c = L.confusion(scores, labels, 0.55), m = L.metrics(c);
  assert.ok(m.accuracy >= 0.97 && m.accuracy <= 0.99, String(m.accuracy));
  assert.ok(c.tp > 10);
});

test('11 s5: train error non-increasing in degree, validation has an interior minimum', () => {
  const r = L.rng(3), f = (x) => Math.sin(2.2 * x);
  const mk = (n) => Array.from({ length: n }, () => { const x = r() * 2 - 1; return [x, f(x) + 0.25 * L.gauss(r)]; });
  const tr = mk(12), va = mk(40);
  const e = [];
  for (let d = 1; d <= 9; d++) {
    const w = L.polyfit(tr.map((p) => p[0]), tr.map((p) => p[1]), d);
    e.push([L.mse(tr.map((p) => p[1]), tr.map((p) => L.polyval(w, p[0]))), L.mse(va.map((p) => p[1]), va.map((p) => L.polyval(w, p[0])))]);
  }
  for (let i = 1; i < 9; i++) assert.ok(e[i][0] <= e[i - 1][0] + 1e-9, 'train up at ' + (i + 1));
  const best = e.reduce((b, v, i) => (v[1] < e[b][1] ? i : b), 0);
  assert.ok(best > 0 && best < 8, 'best at ' + (best + 1));
  assert.ok(e[8][1] > e[best][1] * 3, 'degree 9 should overfit');
});

test('12 s3.9: chart chooser labels equal the lecture cheat-sheet table', () => {
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/../src/widgets.js', 'utf8');
  const md = fs.readFileSync(__dirname + '/../../summarize/12-Data-Visualization.md', 'utf8');
  const sec = md.slice(md.indexOf('### 3.9'), md.indexOf('## 4.'));
  const rows = [...sec.matchAll(/^\| (\w+) \| [^|]+ \| ([^|]+) \|$/gm)].filter((m) => m[1] !== 'Analysis');
  assert.equal(rows.length, 8);
  const lab = src.slice(src.indexOf('const A = ['), src.indexOf('const r = L.rng(5)'));
  rows.forEach((m) => {
    const block = lab.match(new RegExp("\\['" + m[1] + "'.*"))[0].toLowerCase();
    m[2].split(',').map((x) => x.trim().toLowerCase().replace(/ \+ ci/, '')).forEach((chart) => {
      const key = chart.split(' ')[0].replace(/-/g, '');
      assert.ok(block.includes(key.replace('forecast', 'forecast')), m[1] + ': missing ' + chart);
    });
  });
});
