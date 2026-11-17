import { store, save, exState } from "./store.js";
import { LESSONS } from "./lessons.js";
import { runKeysExercise } from "./keys-exercise.js";
import { runNotesExercise } from "./notes-exercise.js";
import { runStaffExercise } from "./staff-exercise.js";
import { connectMidi, onMidiStatus, midiStatusText, midi } from "./input.js";
import { SIZES } from "./music.js";

const app = document.getElementById("app");
let cleanup = null;
function clear() { if (cleanup) { cleanup(); cleanup = null; } }

function shell(title, back) {
  clear();
  app.innerHTML = `
    <header class="top">
      ${back ? `<button class="iconbtn" data-act="back" aria-label="Back">←</button>` : `<span class="logo">🎹</span>`}
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
        const passed = es && es.passed, rounds = es ? es.rounds.length : 0;
        let rec = false;
        if (!passed && !recommended && seen) { recommended = lv.id; rec = true; }
        html += `<button class="level ${passed ? "passed" : ""} ${rec ? "rec" : ""}" data-level="${lv.id}">
          <span class="lvid">${passed ? "✓" : lv.id}</span>
          <span class="lvtxt"><b>${lv.title}</b><small>${lv.desc}${rounds ? ` · ${rounds} round${rounds > 1 ? "s" : ""}` : ""}${lv.timed && es && es.best ? ` · best ${es.best}` : ""}</small></span>
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
      <button class="mini" data-act="prev" ${i === 0 ? "disabled" : ""}>← Back</button>
      <button class="primary" data-act="next">${i === L.steps.length - 1 ? "Start exercises →" : "Next →"}</button>
    </div>`;
  const res = step.visual ? step.visual(v.querySelector(".visual"), v) : null;
  cleanup = () => res && res.cleanup && res.cleanup();
  v.querySelector('[data-act="prev"]').onclick = () => lessonSteps(L, i - 1);
  v.querySelector('[data-act="next"]').onclick = () => {
    if (i < L.steps.length - 1) return lessonSteps(L, i + 1);
    store.lessonSeen[L.id] = true; save();
    const first = L.levels.find(lv => !(store.ex[lv.id] && store.ex[lv.id].passed)) || L.levels[0];
    exercise(L, first);
  };
}

// ---------- exercise ----------
function exercise(L, lv) {
  const v = shell(`${lv.id} · ${lv.title}`, () => home());
  v.classList.add(lv.type === "notes" ? "with-names" : "with-kb");
  const nav = { home };
  cleanup = lv.type === "notes" ? runNotesExercise(v, lv, nav) : lv.type === "staff" ? runStaffExercise(v, lv, nav) : runKeysExercise(v, lv, nav);
}

// ---------- settings ----------
function settings(back) {
  const v = shell("Settings", back);
  const s = store.settings;
  const seg = (name, opts, cur) => `<div class="seg" data-set="${name}">${opts.map(([val, lab]) => `<button data-v="${val}" class="${String(cur) === String(val) ? "on" : ""}">${lab}</button>`).join("")}</div>`;
  v.innerHTML = `
    <div class="card setting"><b>Piano / MIDI</b><p class="muted midistatus">${midiStatusText()}</p>
      <button class="primary ghost" data-act="midi">🎹 Connect piano (MIDI)</button></div>
    <div class="card setting"><b>Keyboard size</b><p class="muted">Must match your real piano — exercises count keys from the bottom.</p>
      ${seg("size", Object.keys(SIZES).map(n => [n, n]), s.size)}</div>
    <div class="card setting"><b>On-screen keyboard</b>${seg("zoom", [["auto", "Auto"], ["fit", "Fit screen"], ["large", "Large keys"]], s.zoom)}</div>
    <div class="card setting"><b>Note names</b>${seg("solf", [[false, "C D E"], [true, "До Ре Ми"]], s.solf)}
      <label class="check"><input type="checkbox" data-check="showOct" ${s.showOct ? "checked" : ""}> Show octave in answers (e.g. F4)</label></div>
    <div class="card setting"><b>Notes per round (Lesson 2)</b>${seg("roundSize", [[10, "10"], [20, "20"], [30, "30"]], s.roundSize)}</div>
    <div class="card setting"><b>Progress</b><p class="muted">Saved in this browser only.</p><button class="mini danger" data-act="reset">Reset all progress</button></div>`;
  v.querySelectorAll("[data-set]").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => {
    const key = g.dataset.set; let val = b.dataset.v;
    if (key === "size" || key === "roundSize") val = +val;
    if (key === "solf") val = val === "true";
    s[key] = val; save();
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
