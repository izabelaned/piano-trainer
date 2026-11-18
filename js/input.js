// Input layer: every source (on-screen keys, MIDI, later microphone)
// reports "key with MIDI number m was pressed". Exercises only listen here.
import { store, save } from "./store.js";
import { SIZES, nameOf } from "./music.js";

const noteListeners = new Set();
const statusListeners = new Set();

export const midi = { status: "off", devices: "" };
// status: off | unsupported | blocked | nodevice | connected

export function onNote(cb) { noteListeners.add(cb); return () => noteListeners.delete(cb); }
export function emitNote(m, source) { noteListeners.forEach(cb => cb(m, source)); }

export function onMidiStatus(cb) { statusListeners.add(cb); return () => statusListeners.delete(cb); }
function setStatus(status, devices = "") {
  midi.status = status; midi.devices = devices;
  statusListeners.forEach(cb => cb(midi));
}

function onMessage(e) {
  const [st, note, vel] = e.data;
  if ((st & 0xf0) === 0x90 && vel > 0) midiNote(note);
}

// ---------- piano shortcuts ----------
// Black-key chords at the two ends of the keyboard, far from where you play. Exercises
// never ask for black keys, so these can't be confused with answers. They follow the keyboard size:
// the top groups confirm, the bottom groups go back / restart.
export function comboKeys() {
  // all complete groups of black keys on this keyboard (2 = C# D#, 3 = F# G# A#), low to high
  const [lo, hi] = SIZES[store.settings.size];
  const groups = [];
  for (let c = lo - (lo % 12); c <= hi; c += 12) {
    [[c + 1, c + 3], [c + 6, c + 8, c + 10]].forEach(g => { if (g[0] >= lo && g[g.length - 1] <= hi) groups.push(g); });
  }
  const n = groups.length;
  return {
    primary: groups[n - 1],      // highest group: Next / Continue / Start
    secondary: groups[n - 2],    // the group before it: Another round / previous step
    back: groups[0],             // lowest group: back / home
    restart: groups[1],          // the next one up: restart the round
  };
}
export const comboName = action => comboKeys()[action].map(nameOf).join(" ");

const COMBO_WINDOW = 350;
let buf = [], flushTimer = null;
function midiNote(m) {
  const combos = comboKeys();
  if (!Object.values(combos).flat().includes(m)) { emitNote(m, "midi"); return; }
  const now = performance.now();
  buf = buf.filter(b => now - b.t < COMBO_WINDOW);
  buf.push({ m, t: now });
  const held = new Set(buf.map(b => b.m));
  for (const [action, keys] of Object.entries(combos)) {
    if (keys.every(k => held.has(k))) {
      buf = []; clearTimeout(flushTimer);
      fireShortcut(action);
      return;
    }
  }
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { const b = buf; buf = []; b.forEach(x => emitNote(x.m, "midi")); }, COMBO_WINDOW);
}

export function fireShortcut(action) {
  const btn = [...document.querySelectorAll(`[data-shortcut="${action}"]`)]
    .find(b => b.offsetParent !== null && !b.disabled && getComputedStyle(b).visibility !== "hidden");
  if (btn) { btn.classList.add("sc-fired"); setTimeout(() => btn.click(), 120); }
}

export async function connectMidi() {
  if (!navigator.requestMIDIAccess) { setStatus("unsupported"); return; }
  try {
    const access = await navigator.requestMIDIAccess();
    const bind = () => {
      const names = [];
      access.inputs.forEach(i => { i.onmidimessage = onMessage; names.push(i.name); });
      setStatus(names.length ? "connected" : "nodevice", names.join(", "));
    };
    access.onstatechange = bind;
    bind();
    store.settings.midi = true; save();
  } catch (e) {
    setStatus("blocked");
  }
}

export function midiStatusText() {
  switch (midi.status) {
    case "connected": return "🎹 Piano connected: " + midi.devices;
    case "nodevice": return "MIDI is on, but no piano found. Plug in the USB cable.";
    case "unsupported": return "This browser has no MIDI support. Use Chrome or Edge (Android, Windows, Mac), not Safari or iPhone.";
    case "blocked": return "MIDI access was blocked. Open the app at izabelaned.github.io/piano-trainer in Chrome and allow MIDI.";
    default: return "Not connected. You can tap the keys on screen instead.";
  }
}

// Reconnect automatically if MIDI was used before.
if (store.settings.midi) connectMidi();
