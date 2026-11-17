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
// Black-key chords far from where you play. Exercises never ask for black keys,
// so these can't be confused with answers. They follow the selected keyboard size.
export function comboKeys() {
  const [lo, hi] = SIZES[store.settings.size];
  let c = lo; while (c % 12) c++;               // lowest full octave
  let t = hi - 10; while (t % 12) t--;          // highest octave with a full 3-black group
  return {
    primary: [c + 6, c + 8, c + 10],            // F# G# A# at the bottom
    secondary: [c + 1, c + 3],                  // C# D# at the bottom
    back: [t + 6, t + 8, t + 10],               // F# G# A# at the top
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
