// Adaptive engine shared by all exercises.
// Each exercise keeps per-item stats: ema (smoothed time, ms) and errEma (smoothed error rate).
export const MAX_MS = 10000;

function median(es) {
  const v = Object.values(es.items).map(x => x.ema).filter(x => x != null).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 2000;
}

export function difficulty(es, key) {
  const d = es.items[key];
  if (!d || d.ema == null) return 1.3;          // unseen: a bit above average
  return d.ema / median(es) + 2.5 * (d.errEma || 0);
}

// Pick one item, weighted toward hard ones, never the same twice in a row.
export function pick(es, keys, prev) {
  const pool = keys.length > 1 ? keys.filter(k => k !== prev) : keys;
  if (!es.rounds.length) return pool[Math.floor(Math.random() * pool.length)];
  const w = pool.map(k => Math.pow(difficulty(es, k), 2.2));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

export function topHard(es, n, keys) {
  return (keys || Object.keys(es.items)).filter(k => es.items[k] && es.items[k].ema != null)
    .sort((a, b) => difficulty(es, b) - difficulty(es, a)).slice(0, n);
}

// log: [{ item, ms (null if not timed), errs, said: [] }]
export function aggregate(log) {
  const per = {};
  log.forEach(r => {
    const p = per[r.item] || (per[r.item] = { seen: 0, errs: 0, times: [], said: {} });
    p.seen++;
    p.errs += r.errs;
    if (r.ms != null) p.times.push(Math.min(MAX_MS, r.ms));
    (r.said || []).forEach(s => { p.said[s] = (p.said[s] || 0) + 1; });
  });
  Object.values(per).forEach(p => { p.avg = p.times.length ? p.times.reduce((a, b) => a + b, 0) / p.times.length : null; });
  return per;
}

// Save a finished round; returns { summary, per, prevRound, prevItems }.
export function finishRound(es, log, { passAcc = 0.9, focus = [], score = null } = {}) {
  const per = aggregate(log);
  const prevRound = es.rounds[es.rounds.length - 1] || null;
  const prevItems = JSON.parse(JSON.stringify(es.items));
  const clean = log.filter(r => r.errs === 0).length;
  const times = log.filter(r => r.ms != null).map(r => Math.min(MAX_MS, r.ms));
  const avgMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;

  Object.entries(per).forEach(([k, p]) => {
    const d = es.items[k] || (es.items[k] = { ema: null, errEma: 0, seen: 0 });
    const t = p.avg != null ? p.avg : MAX_MS * 0.6;
    d.ema = d.ema == null ? t : 0.5 * d.ema + 0.5 * t;
    d.errEma = 0.5 * (d.errEma || 0) + 0.5 * Math.min(1, p.errs / p.seen);
    d.seen = (d.seen || 0) + p.seen;
  });

  const summary = { date: Date.now(), n: log.length, correct: clean, avgMs, focus, score };
  es.rounds.push(summary);
  if (es.rounds.length > 60) es.rounds.shift();
  if (log.length && clean / log.length >= passAcc) es.passed = true;
  if (score != null) es.best = Math.max(es.best || 0, score);
  return { summary, per, prevRound, prevItems };
}
