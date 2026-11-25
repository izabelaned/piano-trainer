// Lesson 9: the C major scale — one hand, hands together, contrary motion — and dynamics
// (how loud each note is, from the MIDI velocity).
import { store, save, exState } from "./store.js";
import { SIZES, nameOf, midiOf, TREBLE_BY_KEY, BASS_BY_KEY } from "./music.js";
import { Keyboard } from "./keyboard.js";
import { onNote, onMidiStatus, midiStatusText } from "./input.js";
import { svgEl, el, drawStaff, drawChord, colorChord, yOf } from "./staff.js";
import { finishRound } from "./engine.js";
import { renderResults } from "./results.js";
import { startGate } from "./countdown.js";

const C = { ink: "#1d1b18", cur: "#3d5a80", ok: "#2e7d4f", bad: "#c0392b" };
const midiOfKey = k => midiOf(k[0], +k.slice(1));
const RH_UP = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"], RH_F_UP = [1, 2, 3, 1, 2, 3, 4, 5], RH_F_DOWN = [5, 4, 3, 2, 1, 3, 2, 1];
const LH_UP = ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"], LH_F_UP = [5, 4, 3, 2, 1, 3, 2, 1], LH_F_DOWN = [1, 2, 3, 1, 2, 3, 4, 5];
const rev = a => [...a].reverse();

// One run = up and back down (the top note once). Each event = the notes to play together.
export function buildRun(run) {
  const ev = (rh, lh) => {
    const notes = [];
    if (rh) notes.push({ key: rh[0], finger: rh[1], clef: "treble" });
    if (lh) notes.push({ key: lh[0], finger: lh[1], clef: "bass" });
    return { notes, midis: [...new Set(notes.map(n => midiOfKey(n.key)))] };
  };
  const zip = (keys, fingers) => keys.map((k, i) => [k, fingers[i]]);
  let rh = null, lh = null;
  if (run === "rh" || run === "both") rh = [...zip(RH_UP, RH_F_UP), ...zip(rev(RH_UP), RH_F_DOWN).slice(1)];
  if (run === "lh" || run === "both") lh = [...zip(LH_UP, LH_F_UP), ...zip(rev(LH_UP), LH_F_DOWN).slice(1)];
  if (run === "contrary") {
    // both thumbs start on middle C, the hands move apart and come back
    rh = [...zip(RH_UP, RH_F_UP), ...zip(rev(RH_UP), RH_F_DOWN).slice(1)];
    lh = [...zip(rev(LH_UP), LH_F_DOWN), ...zip(LH_UP, LH_F_UP).slice(1)];
  }
  const n = (rh || lh).length;
  return Array.from({ length: n }, (_, i) => ev(rh && rh[i], lh && lh[i]));
}

const label = e => e.notes.map(n => n.key).filter((k, i, a) => a.indexOf(k) === i).join("+");

// ---------- dynamics maths ----------
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
function corr(ys) {           // correlation of values with their position: +1 rising, -1 falling
  const xs = ys.map((_, i) => i), mx = mean(xs), my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return den ? num / den : 0;
}

function dynamicsChecks(dyn, vels) {
  if (!dyn) return null;
  const v = vels.filter(x => x != null);
  if (v.length < vels.length * 0.8) {
    return [{ name: "Loudness", ok: false, val: "no data", goal: "play on a MIDI piano with Touch Response on" }];
  }
  if (new Set(v).size === 1) return [{ name: "Loudness", ok: false, val: "all equal", goal: "turn Touch Response on" }];
  if (dyn === "even") {
    const s = Math.round(sd(v));
    return [{ name: "Evenness", ok: s <= 12, val: "±" + s, goal: "≤ ±12" }];
  }
  const half = Math.ceil(v.length / 2);
  const a = v.slice(0, half), b = v.slice(half - 1);       // the turning note belongs to both halves
  const r1 = corr(a), r2 = corr(b), range = Math.round(Math.max(...v) - Math.min(...v));
  const want = dyn === "cresc" ? [1, -1] : [-1, 1];
  const ok1 = r1 * want[0] >= 0.6, ok2 = r2 * want[1] >= 0.6;
  const word = s => (s > 0 ? "louder" : "softer");
  return [
    { name: "Way out", ok: ok1, val: `${Math.round(r1 * want[0] * 100)}% smooth`, goal: `≥ 60% steadily ${word(want[0])}` },
    { name: "Way back", ok: ok2, val: `${Math.round(r2 * want[1] * 100)}% smooth`, goal: `≥ 60% steadily ${word(want[1])}` },
    { name: "Range", ok: range >= 20, val: String(range), goal: "≥ 20 (soft ↔ loud)" },
  ];
}

function velocityChart(vels, dyn) {
  const w = 300, h = 90, n = vels.length, bw = w / n;
  const bars = vels.map((v, i) => v == null ? "" :
    `<rect x="${i * bw + 2}" y="${h - (v / 127) * h}" width="${bw - 4}" height="${(v / 127) * h}" rx="2" fill="#3d5a80"/>`).join("");
  let guide = "";
  if (dyn === "cresc") guide = `<polyline points="0,${h * 0.75} ${w / 2},${h * 0.15} ${w},${h * 0.75}" fill="none" stroke="#e9a23b" stroke-dasharray="4 3"/>`;
  if (dyn === "dim") guide = `<polyline points="0,${h * 0.15} ${w / 2},${h * 0.75} ${w},${h * 0.15}" fill="none" stroke="#e9a23b" stroke-dasharray="4 3"/>`;
  return `<svg viewBox="0 0 ${w} ${h + 14}" class="velchart">${bars}${guide}<text x="0" y="${h + 12}" font-size="9" fill="#7a746b">loudness of each note (0–127)</text></svg>`;
}

// ---------- drawing ----------
export function drawRun(card, events, { grand }) {
  card.innerHTML = "";
  const n = events.length, width = 70 + n * 38;
  const svg = svgEl(grand ? `0 30 ${width} 300` : `0 22 ${width} 160`);
  card.appendChild(svg);
  const top = el("g", {}, svg), bot = grand ? el("g", { transform: "translate(0 130)" }, svg) : null;
  drawStaff(top, { x1: 8, x2: width - 6, clef: "treble" });
  if (grand) {
    drawStaff(bot, { x1: 8, x2: width - 6, clef: "bass" });
    el("line", { x1: 8, x2: 8, y1: yOf(8), y2: yOf(0) + 130, stroke: C.ink, "stroke-width": 2 }, svg);
  }
  const groups = events.map((e, i) => {
    const x = 70 + i * 38, gs = [];
    e.notes.forEach(nt => {
      const g = nt.clef === "bass" ? bot : top, map = nt.clef === "bass" ? BASS_BY_KEY : TREBLE_BY_KEY;
      gs.push(drawChord(g, [map[nt.key].step], x, { finger: nt.finger }));
    });
    return gs;
  });
  return groups;
}

export function runScaleExercise(root, level, nav) {
  const es = exState(level.id);
  const [lo, hi] = SIZES[store.settings.size];
  const events = buildRun(level.run);
  const grand = level.run !== "rh";
  let cleanup = [], alive = true, roundId = 0, first = true;

  function startRound() {
    cleanup.forEach(f => f()); cleanup = [];
    const myRound = ++roundId;
    const round = { i: 0, log: [], vels: [] };
    root.innerHTML = `
      <div class="progress"><button class="mini backmini" title="Back to lessons">←</button><span class="ptxt"></span><div class="bar"><div></div></div><button class="mini fsbtn" title="Full screen">⛶ Full screen</button><button class="mini restart" data-shortcut="restart" title="Start this round again">↺ Restart</button></div>
      <div class="stage">
        <div class="card staff scale"></div>
        <div class="side">
          <div class="sub center"></div>
          <div class="feedback">&nbsp;</div>
          ${level.dyn ? `<div class="velbox"><div class="muted">Loudness</div><div class="velmeter"><div></div></div><div class="vellive"></div></div>` : ""}
        </div>
      </div>
      <div class="kbdock"><div class="kbtools"><span class="midiline muted"></span><span class="pressed muted"></span></div><div class="kbhost"></div></div>`;
    const q = s => root.querySelector(s);
    const kb = new Keyboard(q(".kbhost"), { lo, hi, labels: "c" });
    cleanup.push(() => kb.destroy());
    const showMidi = () => q(".midiline").textContent = midiStatusText();
    showMidi(); cleanup.push(onMidiStatus(showMidi));
    q(".backmini").onclick = nav.home;
    q(".restart").onclick = startRound;
    q(".sub").innerHTML = level.hint || "";
    const groups = drawRun(q(".card.staff"), events, { grand });
    const fb = (cls, txt) => { const f = q(".feedback"); f.className = "feedback " + cls; f.innerHTML = txt; };
    const paint = (i, color) => groups[i].forEach(g => colorChord(g, color));

    let locked = true, tLast = 0, curErrs = 0, curSaid = [], hits = new Map(), firstHit = 0;

    function show() {
      q(".ptxt").textContent = `${Math.min(round.i + 1, events.length)} / ${events.length}`;
      q(".bar > div").style.width = (round.i / events.length * 100) + "%";
      if (round.i < events.length) { paint(round.i, C.cur); kb.scrollTo(events[round.i].midis[0]); }
    }

    function press(m, source, vel) {
      q(".pressed").textContent = nameOf(m) + (vel != null ? ` · ${vel}` : "");
      if (level.dyn && vel != null) {
        q(".velmeter > div").style.width = (vel / 127 * 100) + "%";
      }
      if (locked) return;
      const e = events[round.i], now = performance.now();
      if (e.midis.includes(m)) {
        const win = source === "midi" ? 350 : 700;   // screen taps get a bit more time
        if (hits.size && now - firstHit > win) hits = new Map();
        if (!hits.size) firstHit = now;
        hits.set(m, vel);
        kb.flash(m, "ok", 300);
        if (hits.size < e.midis.length) return;
        const vs = [...hits.values()].filter(v => v != null);
        round.vels.push(vs.length ? mean(vs) : null);
        round.log.push({ item: label(e) + (round.i < events.length / 2 ? " ↑" : " ↓"), ms: now - tLast, errs: curErrs, said: curSaid });
        paint(round.i, curErrs ? C.bad : C.ok);
        events[round.i].midis.forEach(x => kb.state[x] === "hint" && kb.set(x, null));
        if (level.dyn) q(".vellive").innerHTML = velocityChart(round.vels.concat(Array(events.length - round.vels.length).fill(null)), level.dyn);
        round.i++; tLast = now; curErrs = 0; curSaid = []; hits = new Map();
        if (round.i >= events.length) { locked = true; fb("ok", "✓ Scale done"); setTimeout(() => myRound === roundId && alive && endRound(), 700); }
        else { fb("", "&nbsp;"); show(); }
      } else {
        curErrs++; curSaid.push(nameOf(m)); kb.flash(m, "bad");
        fb("bad", "✗ That was " + nameOf(m));
        if (curErrs === 3) e.midis.forEach(x => kb.set(x, "hint"));
      }
    }

    function endRound() {
      cleanup.forEach(f => f()); cleanup = [];
      const extra = dynamicsChecks(level.dyn, round.vels);
      const res = finishRound(es, round.log, { focus: [], criteria: nav.criteria, extra });
      save();
      const vels = round.vels;
      renderResults(root, {
        es, res, label: k => k, itemKeys: null, onNext: startRound, onHome: nav.home, nav, unitWord: "clean",
        extraInsights: () => {
          const out = [];
          const slow = round.log.slice(1).sort((a, b) => b.ms - a.ms)[0];
          if (slow) out.push(`The longest pause was before <b>${slow.item}</b> — ${level.run === "lh" ? "that's often where the 3rd finger crosses over the thumb" : "that's often where the thumb passes under"}.`);
          if (level.dyn && vels.some(v => v != null)) out.push(velocityChart(vels, level.dyn));
          else if (vels.some(v => v != null)) out.push(`Loudness spread: ±${Math.round(sd(vels.filter(v => v != null)))} (lower = more even).`);
          return out;
        },
      });
    }

    cleanup.push(onNote(press));
    startGate(root, { needStart: first }).then(() => {
      if (myRound !== roundId || !alive) return;
      locked = false; tLast = performance.now(); show();
    });
    first = false;
  }

  startRound();
  return () => { alive = false; roundId++; cleanup.forEach(f => f()); };
}
