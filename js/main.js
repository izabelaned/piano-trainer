import { store, save, exState } from "./store.js";
import { LESSONS } from "./lessons.js";
import { runKeysExercise } from "./keys-exercise.js";
import { runNotesExercise } from "./notes-exercise.js";
import { runStaffExercise } from "./staff-exercise.js";
import { connectMidi, onMidiStatus, midiStatusText, midi, comboName } from "./input.js";
import { recount, PASS_ROUNDS } from "./engine.js";
import { SIZES } from "./music.js";

const app = document.getElementById("app");
let cleanup = null;
function clear() { if (cleanup) { cleanup(); cleanup = null; } }

// ---------- levels: order, criteria, locking ----------
const ALL = LESSONS.flatMap(L => L.levels.map(lv => ({ L, lv })));

function criteriaFor(lv) {
  let base;
  if (lv.timed) base = { minScore: 25 };
  else if (lv.tempo) base = { acc: 0.9, maxMs: 150, minBpm: 60, timeName: "Avg off-beat" };
  else if (lv.type === "notes") base = { acc: 0.9, maxMs: 2000 };
  else base = { acc: 0.9, maxMs: 3000 };
  return Object.assign(base, lv.pass || {});
}

function isUnlocked(lv) {
  const i = ALL.findIndex(x => x.lv === lv);
  if (i === 0) return true;
  const es = store.ex[lv.id];
  if (es && es.rounds.length) return true;          // already practised before levels were locked
  const prev = store.ex[ALL[i - 1].lv.id];
  return !!(prev && prev.passed);
}

function nextOf(L, lv) {
  const i = ALL.findIndex(x => x.lv === lv);
  const nx = ALL[i + 1];
  if (!nx) return null;
  if (nx.L !== L) {
    return { label: `Next lesson: ${nx.L.title} →`,
      go: () => (store.lessonSeen[nx.L.id] ? exercise(nx.L, nx.lv) : lessonSteps(nx.L, 0)) };
  }
  return { label: `Next level: ${nx.lv.id} ${nx.lv.title} →`, go: () => exercise(nx.L, nx.lv) };
}

// Rounds played before the criteria existed count if they meet them.
ALL.forEach(({ lv }) => {
  const es = store.ex[lv.id];
  if (es && es.passCount == null) recount(es, criteriaFor(lv));
});
save();

// ---------- piano shortcut labels on buttons ----------
function decorate() {
  const on = midi.status === "connected";
  document.body.classList.toggle("midi-on", on);
  document.querySelectorAll("[data-shortcut]").forEach(b => {
    const txt = "🎹 " + comboName(b.dataset.shortcut);
    let sc = b.querySelector(".sc");
    if (!sc) { sc = document.createElement("span"); sc.className = "sc"; b.appendChild(sc); }
    if (sc.textContent !== txt) sc.textContent = txt;
  });
}
new MutationObserver(decorate).observe(app, { childList: true, subtree: true });

// Computer keyboard: Enter = the main button on screen (Next / Another round / Start …).
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" || e.repeat || e.target.closest("input, textarea")) return;
  if (e.target.closest("button")) return;            // a focused button already handles Enter itself
  const btn = [...document.querySelectorAll('[data-shortcut="primary"]')]
    .find(b => b.offsetParent !== null && !b.disabled && getComputedStyle(b).visibility !== "hidden");
  if (btn) { e.preventDefault(); btn.click(); }
});
onMidiStatus(decorate);

function shell(title, back) {
  clear();
  app.innerHTML = `
    <header class="top">
      ${back ? `<button class="iconbtn" data-act="back" data-shortcut="back" aria-label="Back">←</button>` : `<span class="logo">🎹</span>`}
      <div class="ttl">${title}</div>
      <button class="iconbtn" data-act="settings" aria-label="Settings">⚙︎</button>
    </header>
    <main class="view"></main>`;
  if (back) app.querySelector('[data-act="back"]').onclick = back;
  app.querySelector('[data-act="settings"]').onclick = () => settings(() => home());
  window.scrollTo(0, 0);
  return app.querySelector(".view");
}

// ---------- home ----------
function home() {
  const v = shell("Piano Trainer");
  let html = `<div class="midipill ${midi.status === "connected" ? "on" : ""}">${midiStatusText()}</div>`;
  let recommended = null;
  LESSONS.forEach(L => {
    const seen = store.lessonSeen[L.id];
    html += `<section class="lesson card ${L.comingSoon ? "soon" : ""}">
      <div class="lhead"><div><div class="lnum">Lesson ${L.id}</div><div class="ltitle">${L.title}</div></div>
      ${L.comingSoon ? `<span class="badge">Coming soon</span>` : `<button class="mini ${seen ? "" : "accent"}" data-lesson="${L.id}">${seen ? "Review lesson" : "Start lesson"}</button>`}</div>
      <div class="muted">${L.blurb}</div>`;
    if (L.levels.length) {
      html += `<div class="levels">`;
      L.levels.forEach(lv => {
        const es = store.ex[lv.id];
        const passed = es && es.passed, open = isUnlocked(lv);
        const pc = es ? Math.min(es.passCount || 0, PASS_ROUNDS) : 0;
        let rec = false;
        if (!passed && open && !recommended && seen) { recommended = lv.id; rec = true; }
        const prog = passed ? "passed" : open ? `${pc}/${PASS_ROUNDS} passing rounds` : "locked — pass the previous level first";
        html += `<button class="level ${passed ? "passed" : ""} ${rec ? "rec" : ""} ${open ? "" : "locked"}" data-level="${lv.id}" ${open ? "" : "disabled"} ${rec ? 'data-shortcut="primary"' : ""}>
          <span class="lvid">${passed ? "✓" : open ? lv.id : "🔒"}</span>
          <span class="lvtxt"><b>${lv.title}</b><small>${lv.desc}</small><small class="prog">${prog}${lv.timed && es && es.best ? ` · best ${es.best}` : ""}</small></span>
          ${rec ? `<span class="next">next</span>` : ""}</button>`;
      });
      html += `</div>`;
    }
    html += `</section>`;
  });
  v.innerHTML = html;
  v.querySelectorAll("[data-lesson]").forEach(b => b.onclick = () => lessonSteps(LESSONS.find(l => l.id === b.dataset.lesson), 0));
  v.querySelectorAll("[data-level]").forEach(b => b.onclick = () => {
    const id = b.dataset.level;
    const L = LESSONS.find(l => l.levels.some(x => x.id === id));
    exercise(L, L.levels.find(x => x.id === id));
  });
  const off = onMidiStatus(() => { const p = v.querySelector(".midipill"); if (p) { p.textContent = midiStatusText(); p.classList.toggle("on", midi.status === "connected"); } });
  cleanup = off;
}

// ---------- lesson steps ----------
function lessonSteps(L, i) {
  const v = shell(`Lesson ${L.id} · ${L.title}`, () => home());
  const step = L.steps[i];
  v.innerHTML = `
    <div class="dots">${L.steps.map((_, j) => `<span class="${j === i ? "on" : j < i ? "done" : ""}"></span>`).join("")}</div>
    <div class="card stepcard"><div class="stepno">Step ${i + 1} of ${L.steps.length}</div><h2>${step.title}</h2>${step.html}</div>
    <div class="visual"></div>
    <div class="stepnav">
      <button class="mini" data-act="prev" data-shortcut="secondary" ${i === 0 ? "disabled" : ""}>← Back</button>
      <button class="primary" data-act="next" data-shortcut="primary">${i === L.steps.length - 1 ? "Start exercises →" : "Next →"}</button>
    </div>`;
  const res = step.visual ? step.visual(v.querySelector(".visual"), v) : null;
  cleanup = () => res && res.cleanup && res.cleanup();
  v.querySelector('[data-act="prev"]').onclick = () => lessonSteps(L, i - 1);
  v.querySelector('[data-act="next"]').onclick = () => {
    if (i < L.steps.length - 1) return lessonSteps(L, i + 1);
    store.lessonSeen[L.id] = true; save();
    const first = L.levels.find(lv => !(store.ex[lv.id] && store.ex[lv.id].passed)) || L.levels[0];
    if (!isUnlocked(first)) return home();
    exercise(L, first);
  };
}

// ---------- exercise ----------
function exercise(L, lv) {
  const v = shell(`${lv.id} · ${lv.title}`, () => home());
  v.classList.add(lv.type === "notes" ? "with-names" : "with-kb");
  const nav = { home, criteria: criteriaFor(lv), next: nextOf(L, lv) };
  const stop = lv.type === "notes" ? runNotesExercise(v, lv, nav) : lv.type === "staff" ? runStaffExercise(v, lv, nav) : runKeysExercise(v, lv, nav);
  // keep content clear of the docked keyboard / name buttons, whatever their height
  let ro = null;
  const fitPadding = () => { const d = v.querySelector(".kbdock, .namedock"); v.style.paddingBottom = d ? (d.offsetHeight + 24) + "px" : ""; };
  if (window.ResizeObserver) { ro = new ResizeObserver(fitPadding); ro.observe(v); }
  fitPadding();
  if (lv.type !== "notes") addRotateHint(v);
  cleanup = () => { if (ro) ro.disconnect(); stop && stop(); };
}

function addRotateHint(v) {
  if (store.settings.hideRotate) return;
  const h = document.createElement("div");
  h.className = "rotatehint";
  const canFs = !!document.documentElement.requestFullscreen;
  h.innerHTML = `<span>📱↻ Turn your phone sideways for a bigger keyboard.</span>
    ${canFs ? `<button class="mini" data-act="fs">Full screen</button>` : ""}<button class="iconbtn" data-act="x" aria-label="Hide">✕</button>`;
  v.prepend(h);
  if (canFs) h.querySelector('[data-act="fs"]').onclick = async () => {
    try {
      await document.documentElement.requestFullscreen();
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape");
    } catch (e) {}
  };
  h.querySelector('[data-act="x"]').onclick = () => { store.settings.hideRotate = true; save(); h.remove(); };
}

// ---------- settings ----------
function settings(back) {
  const v = shell("Settings", back);
  const s = store.settings;
  const seg = (name, opts, cur) => `<div class="seg" data-set="${name}">${opts.map(([val, lab]) => `<button data-v="${val}" class="${String(cur) === String(val) ? "on" : ""}">${lab}</button>`).join("")}</div>`;
  v.innerHTML = `
    <div class="card setting"><b>Piano / MIDI</b><p class="muted midistatus">${midiStatusText()}</p>
      <button class="primary ghost" data-act="midi">🎹 Connect piano (MIDI)</button></div>
    <div class="card setting"><b>Piano shortcuts</b><p class="muted">Press 3 black keys together (2 for “another round”) instead of touching the screen. They follow your keyboard size and only work for buttons that are on screen.</p>
      <table class="sctable"><tr><td>Next / Continue / Start</td><td><b>${comboName("primary")}</b></td></tr>
      <tr><td>Another round / previous step</td><td><b>${comboName("secondary")}</b></td></tr>
      <tr><td>Back to lessons</td><td><b>${comboName("back")}</b></td></tr></table></div>
    <div class="card setting"><b>Keyboard size</b><p class="muted">Must match your real piano — exercises count keys from the bottom.</p>
      ${seg("size", Object.keys(SIZES).map(n => [n, n]), s.size)}</div>
    <div class="card setting"><b>On-screen keyboard</b>${seg("zoom", [["fit", "Whole keyboard"], ["large", "Large keys (scroll)"]], s.zoom === "large" ? "large" : "fit")}</div>
    <div class="card setting"><b>Answers</b>
      <label class="check"><input type="checkbox" data-check="showOct" ${s.showOct ? "checked" : ""}> Show octave in answers (e.g. F4)</label></div>
    <div class="card setting"><b>Notes per round (Lesson 2)</b>${seg("roundSize", [[10, "10"], [20, "20"], [30, "30"]], s.roundSize)}</div>
    <div class="card setting"><b>Progress</b><p class="muted">Saved in this browser only.</p><button class="mini danger" data-act="reset">Reset all progress</button></div>`;
  v.querySelectorAll("[data-set]").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => {
    const key = g.dataset.set; let val = b.dataset.v;
    if (key === "size" || key === "roundSize") val = +val;
    s[key] = val; save();
    if (key === "size") return settings(back);
    g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
  }));
  v.querySelector('[data-check="showOct"]').onchange = e => { s.showOct = e.target.checked; save(); };
  v.querySelector('[data-act="midi"]').onclick = connectMidi;
  const off = onMidiStatus(() => v.querySelector(".midistatus").textContent = midiStatusText());
  cleanup = off;
  const rb = v.querySelector('[data-act="reset"]');
  rb.onclick = () => {
    if (rb.dataset.armed) { store.ex = {}; store.lessonSeen = {}; save(); rb.textContent = "Progress reset"; delete rb.dataset.armed; }
    else { rb.dataset.armed = 1; rb.textContent = "Tap again to confirm"; }
  };
}

// First visit: open Lesson 1.
if (!store.lessonSeen["1"] && !Object.keys(store.ex).length) lessonSteps(LESSONS[0], 0);
else home();
