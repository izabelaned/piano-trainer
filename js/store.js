// Progress and settings, kept in this browser's localStorage.
const KEY = "pianoTrainerV3";

function defaults() {
  return {
    settings: { size: 88, showOct: false, roundSize: 20, midi: false, zoom: "fit" },
    ex: {},          // per-exercise state
    lessonSeen: {},  // lessonId -> true once the steps were finished
  };
}

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  const d = defaults();
  if (s) {
    d.settings = Object.assign(d.settings, s.settings || {});
    delete d.settings.solf;
    d.ex = s.ex || {};
    d.lessonSeen = s.lessonSeen || {};
    d.mig4 = s.mig4;
    d.mig5 = s.mig5;
    d.mig6 = s.mig6;
    d.mig7 = s.mig7;
  }
  // Tempo levels moved to Lesson 4: old 3.5 → 4.2, old 3.6 (double notes) → 3.5, old 3.7 → 4.4
  if (!d.mig4) {
    const ex = d.ex, o35 = ex["3.5"], o36 = ex["3.6"], o37 = ex["3.7"];
    delete ex["3.5"]; delete ex["3.6"]; delete ex["3.7"];
    if (o35) { ex["4.2"] = o35; delete o35.critV; }
    if (o36) { ex["3.5"] = o36; delete o36.critV; }
    if (o37) { ex["4.4"] = o37; delete o37.critV; }
    d.mig4 = true;
  }
  // Lesson 3 got four easy "just find it" levels first: 3.1→3.4, 3.2→3.5, 3.3→3.6, 3.4→3.7, 3.5→3.8
  if (!d.mig5) {
    const ex = d.ex, moved = {};
    ["3.1", "3.2", "3.3", "3.4", "3.5"].forEach(k => { if (ex[k]) { moved[k] = ex[k]; delete ex[k]; } });
    const to = { "3.1": "3.4", "3.2": "3.5", "3.3": "3.6", "3.4": "3.7", "3.5": "3.8" };
    Object.entries(moved).forEach(([k, v]) => { delete v.critV; ex[to[k]] = v; });
    d.mig5 = true;
  }
  // Fingering got its own lesson: 4.x (in time) → 5.x, then 3.5–3.8 → 4.1–4.4
  if (!d.mig6) {
    const ex = d.ex;
    ["4.1", "4.2", "4.3", "4.4"].forEach(k => { if (ex[k]) { ex["5." + k[2]] = ex[k]; delete ex[k].critV; delete ex[k]; } });
    [["3.5", "4.1"], ["3.6", "4.2"], ["3.7", "4.3"], ["3.8", "4.4"]].forEach(([a, b]) => { if (ex[a]) { ex[b] = ex[a]; delete ex[b].critV; delete ex[a]; } });
    if (d.lessonSeen["4"]) { d.lessonSeen["5"] = true; delete d.lessonSeen["4"]; }
    d.mig6 = true;
  }
  // Tempo lesson rebuilt with tempo words: old 5.4 (double notes in time) → 5.6
  if (!d.mig7) {
    if (d.ex["5.4"]) { d.ex["5.6"] = d.ex["5.4"]; delete d.ex["5.6"].critV; delete d.ex["5.4"]; }
    ["5.1", "5.2", "5.3"].forEach(k => { if (d.ex[k]) delete d.ex[k].critV; });
    d.mig7 = true;
  }
  // Carry over stats from the first version of the note trainer.
  try {
    const old = JSON.parse(localStorage.getItem("trebleTrainerV2"));
    if (old && old.rounds && old.rounds.length && !d.ex["2.4"]) {
      d.ex["2.4"] = { rounds: old.rounds, items: old.notes || {}, passed: false, best: null };
    }
  } catch (e) {}
  return d;
}

export const store = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
}

export function exState(id) {
  return store.ex[id] || (store.ex[id] = { rounds: [], items: {}, passed: false, best: null });
}
