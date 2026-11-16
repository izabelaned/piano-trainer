// Input layer: every source (on-screen keys, MIDI, later microphone)
// reports "key with MIDI number m was pressed". Exercises only listen here.
import { store, save } from "./store.js";

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
  if ((st & 0xf0) === 0x90 && vel > 0) emitNote(note, "midi");
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
