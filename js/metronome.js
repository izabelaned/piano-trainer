// Metronome clicks with the Web Audio API.
let ctx = null;
const pending = new Set();   // clicks scheduled but maybe not played yet

export function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function click(c, t, accent) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.value = accent ? 1600 : 1000;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? 0.6 : 0.4, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + 0.06);
  pending.add(o);
  o.onended = () => pending.delete(o);
}

// Silence every click that is still scheduled (restart, leaving the screen…).
export function stopClicks() {
  pending.forEach(o => { try { o.stop(); o.disconnect(); } catch (e) {} });
  pending.clear();
}

// Schedule n clicks. Returns beat 0 in performance.now() time and the beat length in ms.
export function schedule(n, bpm) {
  const beatMs = 60000 / bpm;
  const c = audio();
  if (!c) return { t0Perf: performance.now() + 300, beatMs };
  const t0 = c.currentTime + 0.3;
  for (let i = 0; i < n; i++) click(c, t0 + i * beatMs / 1000, i % 4 === 0);
  const offsetMs = performance.now() - c.currentTime * 1000;
  return { t0Perf: t0 * 1000 + offsetMs, beatMs };
}
