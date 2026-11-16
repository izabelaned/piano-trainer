// Progress and settings, kept in this browser's localStorage.
const KEY = "pianoTrainerV3";

function defaults() {
  return {
    settings: { size: 88, solf: false, showOct: false, roundSize: 20, midi: false, zoom: "auto" },
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
    d.ex = s.ex || {};
    d.lessonSeen = s.lessonSeen || {};
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
