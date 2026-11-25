// Lesson content: teaching steps + exercise levels.
import { LETTERS, SIZES, MIDDLE_C, TREBLE, BASS, byClef, keysOfLetter, nameOf, isWhite, letterOf, midiOf, FINGER_NAMES } from "./music.js";
import { Keyboard } from "./keyboard.js";
import { onNote, connectMidi, onMidiStatus, midiStatusText } from "./input.js";
import { drawStaff, drawNote, svgEl, el, yOf, drawMeasure, colorChord } from "./staff.js";
import { schedule, audio, stopClicks, playMelody } from "./metronome.js";
import { store, save } from "./store.js";
import { pick, difficulty } from "./engine.js";
import { handsSvg, handWords } from "./hands.js";
import { buildRun, drawRun } from "./scale-exercise.js";

// Tempo words for Lesson 5 (defined first: the lesson text uses them)
const TEMPI = [
  { name: "Lento", meaning: "slow", range: "45–60", bpm: 54 },
  { name: "Andante", meaning: "at a walking pace", range: "76–108", bpm: 80 },
  { name: "Moderato", meaning: "moderate", range: "108–120", bpm: 108 },
  { name: "Allegro", meaning: "fast, lively", range: "120–156", bpm: 126 },
];

// ---------- step visual helpers ----------
function kbVisual(host, { lo = 48, hi = 72, labels = "none", mark = null, info = true } = {}) {
  const box = document.createElement("div");
  host.appendChild(box);
  const kb = new Keyboard(box, { lo, hi, labels, fit: hi - lo <= 36 ? true : null });
  if (mark) mark(kb);
  const line = document.createElement("div");
  line.className = "pressedline muted";
  line.textContent = info ? "Tap a key (or play your piano) to see its name." : "";
  host.appendChild(line);
  const off = onNote(m => {
    if (info) line.innerHTML = `You played <b>${nameOf(m)}</b>`;
    kb.flash(m, "ok", 350);
  });
  return { kb, cleanup: () => { off(); kb.destroy(); } };
}


function staffVisual(host, notes, { clef = true, numbers = false, width = 360, mark = "B" } = {}) {
  const svg = svgEl(`0 40 ${width} 172`);
  drawStaff(svg, { x1: 6, x2: width - 6, clef });
  if (numbers) for (let i = 0; i < 5; i++) el("text", { x: width - 14, y: yOf(i * 2) + 4, "font-size": 10, fill: "#7a746b", "text-anchor": "middle" }, svg).textContent = i + 1;
  const MAP = byClef(clef);
  const x0 = clef ? 92 : 50, dx = Math.min(36, (width - x0 - 30) / Math.max(1, notes.length - 1));
  notes.forEach((key, i) => {
    const n = MAP[key], x = x0 + i * dx;
    const c = (mark === "B" ? n.letter === "B" : key === mark) ? "#3d5a80" : "#1d1b18";
    drawNote(svg, n.step, x, { color: c, stem: false });
    el("text", { x, y: 182, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: c }, svg).textContent = key;
  });
  const card = document.createElement("div");
  card.className = "card staff";
  card.appendChild(svg);
  host.appendChild(card);
  return {};
}

// Treble staff on top, bass staff below, joined — the "grand staff". notes: [{ key, clef }]
function grandStaff(host, notes = [], { width = 360 } = {}) {
  const svg = svgEl(`0 40 ${width} 270`);
  const top = el("g", {}, svg), bot = el("g", { transform: "translate(0 120)" }, svg);
  drawStaff(top, { x1: 14, x2: width - 6, clef: "treble" });
  drawStaff(bot, { x1: 14, x2: width - 6, clef: "bass" });
  el("line", { x1: 14, x2: 14, y1: yOf(8), y2: yOf(0) + 120, stroke: "#1d1b18", "stroke-width": 2 }, svg);
  const x0 = 110, dx = Math.min(44, (width - x0 - 30) / Math.max(1, notes.length - 1));
  notes.forEach((n, i) => {
    const x = x0 + i * dx, g = n.clef === "bass" ? bot : top, info = byClef(n.clef)[n.key];
    const c = n.key === "C4" ? "#3d5a80" : "#1d1b18";
    drawNote(g, info.step, x, { color: c, stem: false });
    el("text", { x, y: n.clef === "bass" ? yOf(info.step) + 120 + 26 : yOf(info.step) - 14, "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: c }, svg).textContent = n.key;
  });
  const card = document.createElement("div");
  card.className = "card staff";
  card.appendChild(svg);
  host.appendChild(card);
  return {};
}

// ---------- Lesson 1 exercise generators ----------
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
const letterLabel = k => k;

function namesTask(ctx, k, finger, hand) {
  const L = pick(ctx.es, LETTERS, ctx.prev);
  const all = keysOfLetter(L, ctx.lo, ctx.hi);
  const ks = hand ? handKeys(all, hand) : all;
  // shown in mixed order (never simply low to high), so you have to read each one
  let chosen = shuffle(ks).slice(0, Math.min(k, ks.length));
  for (let t = 0; t < 10 && chosen.length > 1 && chosen.every((m, i) => i === 0 || m > chosen[i - 1]); t++) chosen = shuffle(chosen);
  const names = chosen.map(nameOf);
  const list = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
  return {
    item: L,
    prompt: `Play <b>${list}</b>`,
    sub: "Any order. The C labels show each octave — middle C is C4.",
    hand, finger,
    targets: chosen.map(m => ({ m, label: nameOf(m) })),
  };
}

// Right hand plays middle C and above, left hand middle C and below.
function handKeys(ks, hand) {
  const r = ks.filter(m => (hand === "R" ? m >= MIDDLE_C : m <= MIDDLE_C));
  return r.length ? r : ks;
}

function handTask(ctx, hand) {
  const L = pick(ctx.es, LETTERS, ctx.prev);
  const opts = handKeys(keysOfLetter(L, ctx.lo, ctx.hi), hand);
  const m = opts[rnd(opts.length)], f = 1 + rnd(5);
  return {
    item: L,
    prompt: `Play <b>${nameOf(m)}</b>`,
    hand, finger: f,
    targets: [{ m, label: nameOf(m) }],
  };
}

function mixTask(ctx) {
  const letters = shuffle(LETTERS).slice(0, 3);
  let hand = Math.random() < 0.5 ? "L" : "R";
  const targets = letters.map(L => {
    const opts = handKeys(keysOfLetter(L, ctx.lo, ctx.hi), hand);
    const m = opts[rnd(opts.length)], f = 1 + rnd(5);
    const t = { m, item: L, label: nameOf(m), hand, finger: f };
    hand = hand === "L" ? "R" : "L";
    return t;
  });
  return { item: letters.join(""), ordered: true, prompt: "Play in order:", sub: "Hands alternate — follow the highlighted finger.", targets };
}

function noteRange(lo, hi) {
  const out = [];
  for (let m = Math.max(lo, 36); m <= Math.min(hi, 96); m++) if (isWhite(m)) out.push(nameOf(m));
  return out;
}

// ---------- Lessons ----------
export const LESSONS = [
  {
    id: "1",
    title: "The keyboard",
    blurb: "Find any key by its name (F3, C4…), finger numbers.",
    steps: [
      {
        title: "White keys and black keys",
        html: `<p>A piano has <b>white keys</b> and <b>black keys</b>.</p>
               <p>The black keys come in <b>groups of 2</b> and <b>groups of 3</b>. This pattern repeats along the whole keyboard — it's your map. Every key is found by where it sits next to these groups.</p>
               <p class="muted">The groups of 2 are highlighted below.</p>`,
        visual: h => kbVisual(h, { mark: kb => { for (let m = 48; m <= 72; m++) if ([1, 3].includes(m % 12)) kb.set(m, "hint"); } }),
      },
      {
        title: "Find C",
        html: `<p><b>C</b> is the white key just to the <b>left of every group of 2 black keys</b>.</p>
               <p>Find C first — every other key is easy to find from there.</p>`,
        visual: h => kbVisual(h, { mark: kb => [48, 60, 72].forEach(m => kb.set(m, "target")) }),
      },
      {
        title: "The musical alphabet",
        html: `<p>The white keys use only 7 letters: <b>C D E F G A B</b>. After B it starts again with C.</p>
               <div class="alphabet">C D E F G A B <span class="muted">→ C D E …</span></div>`,
        visual: h => kbVisual(h, { labels: "all" }),
      },
      {
        title: "Low and high, not left and right",
        html: `<p>On a piano we don't say left and right. We say <b>low</b> and <b>high</b>.</p>
               <p>Keys to the left sound <b>lower</b>, keys to the right sound <b>higher</b>. Moving right is going <b>up</b> the keyboard; moving left is going <b>down</b>.</p>
               <p>The ends of the keyboard are the <b>bottom</b> (lowest keys, far left) and the <b>top</b> (highest keys, far right) — e.g. "the bottom note", "top C".</p>
               <div class="lowhigh"><span>← lower · down</span><span>up · higher →</span></div>`,
        visual: h => kbVisual(h, { labels: "c" }),
      },
      {
        title: "Octaves and middle C",
        html: `<p>From one C to the next C is an <b>octave</b>. Each octave has a number, and the number goes up at every C: … B3, <b>C4</b>, D4 …</p>
               <p><b>Middle C = C4</b>. It's the C closest to the middle of the keyboard, usually right under the brand name. The B just below it is B3.</p>
               <p class="muted">On 88-key pianos the lowest key is A0 and the highest is C8.</p>`,
        visual: h => kbVisual(h, { lo: 48, hi: 72, labels: "allOct", mark: kb => kb.set(MIDDLE_C, "target") }),
      },
      {
        title: "Your keyboard",
        html: `<p>Note names are the same on every piano: <b>middle C is always C4</b>. A smaller keyboard simply has fewer keys at both ends — a 61-key keyboard goes from <b>C2 to C7</b>, a full 88-key piano from <b>A0 to C8</b>.</p>
               <p>Pick your size so the keyboard on screen looks exactly like yours.</p>
               <div class="seg sizes"></div>
               <p class="muted sizeinfo"></p>`,
        visual: (h, root) => {
          let v = null;
          const render = () => {
            if (v) v.cleanup();
            const [lo, hi] = SIZES[store.settings.size];
            v = kbVisual(h, { lo, hi, labels: "c", mark: kb => { kb.set(MIDDLE_C, "target"); setTimeout(() => kb.scrollTo(MIDDLE_C), 0); } });
            root.querySelector(".sizeinfo").innerHTML = `Lowest key: <b>${nameOf(lo)}</b> · highest: <b>${nameOf(hi)}</b> · middle C is marked.`;
            const seg = root.querySelector(".sizes"); seg.innerHTML = "";
            Object.keys(SIZES).forEach(n => {
              const b = document.createElement("button"); b.textContent = n;
              b.className = +n === store.settings.size ? "on" : "";
              b.onclick = () => { store.settings.size = +n; save(); h.innerHTML = ""; render(); };
              seg.appendChild(b);
            });
          };
          render();
          return { cleanup: () => v && v.cleanup() };
        },
      },
      {
        title: "Finger numbers",
        html: `<p>Each finger has a number, the same on both hands: <b>1 = thumb, 2 = index, 3 = middle, 4 = ring, 5 = pinky</b>.</p>
               <p>Both hands count from the thumb. So on the keyboard the left hand reads 5 4 3 2 1 from left to right, and the right hand reads 1 2 3 4 5.</p>
               <p class="muted">In the exercises the finger to use is highlighted on a picture like this one.</p>`,
        visual: h => { h.innerHTML = `<div class="card">${handsSvg()}</div>`; return {}; },
      },
      {
        title: "Connect your piano (optional)",
        html: `<p>You can tap the keys on screen, or play your real piano.</p>
               <p>To use your digital piano: connect its <b>USB to Host</b> port to your phone or laptop (on a phone you need an OTG adapter), open this app in <b>Chrome</b>, and press the button. The app will hear every key you press.</p>
               <button class="primary ghost" data-act="midi">🎹 Connect piano (MIDI)</button>
               <p class="muted midistatus"></p>
               <p class="muted">The app can check <i>which key</i> you played, but not which finger — that part is on your honour.</p>
               <p class="muted"><b>Piano shortcuts:</b> once connected, press a group of black keys together instead of tapping buttons — the highest group for “Next”, the group just below it for “Another round”, the lowest group for “Back”, the next one up to restart a round. Each button shows its chord.</p>`,
        visual: (h, root) => {
          const st = root.querySelector(".midistatus");
          const show = () => st.textContent = midiStatusText();
          show();
          root.querySelector('[data-act="midi"]').onclick = connectMidi;
          const off = onMidiStatus(show);
          const v = kbVisual(h, { labels: "c" });
          return { cleanup: () => { off(); v.cleanup(); } };
        },
      },
    ],
    levels: [
      { id: "1.1", title: "Find them all", desc: "Play 3 different keys with the same letter.", tasks: 10,
        make: ctx => { const L = pick(ctx.es, LETTERS, ctx.prev); const n = Math.min(3, keysOfLetter(L, ctx.lo, ctx.hi).length);
          return { item: L, any: { letter: L, count: n }, prompt: `Play <b>${n} different ${L}</b> keys`, sub: "Any order, any finger." }; },
        itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.2", title: "Octave names", desc: "Play F5, F3, F6… — the C labels guide you.", tasks: 10,
        make: ctx => namesTask(ctx, 3), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.3", title: "Index finger only", desc: "Same, always with RH 2.", tasks: 10,
        make: ctx => namesTask(ctx, 2, 2, "R"), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.4", title: "Right hand, every finger", desc: "One key, a given RH finger.", tasks: 10,
        make: ctx => handTask(ctx, "R"), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.5", title: "Left hand, every finger", desc: "One key, a given LH finger.", tasks: 10,
        make: ctx => handTask(ctx, "L"), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.6", title: "Mix it up", desc: "3 keys in order, alternating hands and fingers.", tasks: 6,
        make: mixTask, itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.7", title: "No labels", desc: "Find F4, C5, A3… on a bare keyboard.", tasks: 10, labels: "none",
        make: ctx => {
          const keys = noteRange(ctx.lo, ctx.hi);
          const k = pick(ctx.es, keys, ctx.prev);
          const L = k[0], oct = +k.slice(1), m = midiOf(L, oct);
          const hand = m < MIDDLE_C ? "L" : "R", f = 1 + rnd(5);
          return { item: k, prompt: `Play <b>${k}</b>`, hand, finger: f, targets: [{ m, label: k }] };
        },
        itemKeys: (lo, hi) => noteRange(lo, hi), label: k => k },
    ],
  },
  {
    id: "2",
    title: "Reading notes",
    blurb: "The staff, the treble clef, and every note from B3 to B5.",
    steps: [
      {
        title: "The staff",
        html: `<p>Music is written on a <b>staff</b>: <b>5 lines</b> and the <b>4 spaces</b> between them.</p>
               <p>Lines and spaces are always counted <b>from the bottom up</b>: line 1 is the lowest line.</p>`,
        visual: h => staffVisual(h, [], { clef: false, numbers: true }),
      },
      {
        title: "Lines and spaces",
        html: `<p>A note sits either <b>on a line</b> (the line goes through it) or <b>in a space</b> (between two lines).</p>
               <p>Every step up — line, space, line, space — is the <b>next letter</b> of the alphabet. Higher on the staff = higher on the keyboard.</p>`,
        visual: h => staffVisual(h, ["E4", "F4", "G4", "A4", "B4", "C5", "D5"], { clef: false }),
      },
      {
        title: "The treble clef",
        html: `<p>The sign at the start is a <b>clef</b>. It tells you which note is which. This one is the <b>treble clef</b>, also called the <b>G clef</b>.</p>
               <p>Its curl wraps around <b>line 2</b>, and that line is <b>G4</b> — the G just above middle C. Everything else is counted from there.</p>
               <p class="muted">The treble clef is used for higher notes, which you usually play with the right hand.</p>`,
        visual: h => staffVisual(h, ["G4"]),
      },
      {
        title: "Line notes: E G B D F",
        html: `<p>The 5 lines, bottom to top, are <b>E G B D F</b>.</p>
               <p>Remember it as <i>"<b>E</b>very <b>G</b>ood <b>B</b>oy <b>D</b>oes <b>F</b>ine"</i>.</p>`,
        visual: h => staffVisual(h, ["E4", "G4", "B4", "D5", "F5"]),
      },
      {
        title: "Space notes: F A C E",
        html: `<p>The 4 spaces, bottom to top, spell <b>F A C E</b> — like the word <i>"face"</i>.</p>`,
        visual: h => staffVisual(h, ["F4", "A4", "C5", "E5"]),
      },
      {
        title: "Ledger lines",
        html: `<p>Notes can go beyond the staff. Then we draw short extra lines just for them: <b>ledger lines</b>.</p>
               <p><b>Middle C (C4)</b> sits on one ledger line below the staff, and <b>B3</b> hangs just under it. <b>D4</b> sits right under the bottom line.</p>
               <p>Above: <b>G5</b> sits on top of the staff, <b>A5</b> is on a ledger line, and <b>B5</b> sits on top of it.</p>`,
        visual: h => staffVisual(h, ["B3", "C4", "D4", "G5", "A5", "B5"]),
      },
      {
        title: "The full map: B3 → B5",
        html: `<p>Here are all 15 notes you'll practise, step by step. The three <b>B</b>s (blue) are your landmarks: <b>B3</b> below the staff, <b>B4 on the middle line</b>, <b>B5</b> above the staff.</p>`,
        visual: h => { staffVisual(h, TREBLE.slice(0, 7).map(n => n.key)); staffVisual(h, TREBLE.slice(7).map(n => n.key)); return {}; },
      },
    ],
    levels: [
      { id: "2.1", type: "notes", title: "Line notes", desc: "E G B D F only.", pass: { maxMs: 1000 }, keys: ["E4", "G4", "B4", "D5", "F5"] },
      { id: "2.2", type: "notes", title: "Space notes", desc: "F A C E only.", pass: { maxMs: 1000 }, keys: ["F4", "A4", "C5", "E5"] },
      { id: "2.3", type: "notes", title: "The whole staff", desc: "E4 to F5, lines and spaces.", keys: TREBLE.filter(n => n.step >= 0 && n.step <= 8).map(n => n.key) },
      { id: "2.4", type: "notes", title: "With ledger lines", desc: "Full range B3 to B5.", keys: TREBLE.map(n => n.key) },
      { id: "2.5", type: "notes", optional: true, title: "60-second challenge", desc: "How many can you name in a minute? Pass: 25.", keys: TREBLE.map(n => n.key), timed: true },
    ],
  },
  {
    id: "3",
    title: "Notes on the keyboard",
    blurb: "See a note on the staff, find it on the keyboard — any finger.",
    steps: [
      {
        title: "One note, one key",
        html: `<p>Every note on the staff is <b>exactly one key</b> on the piano. Middle C on its little ledger line is <b>C4</b> — the middle C on your keyboard.</p>
               <p><b>Try it:</b> play any white key from B3 to B5 and watch where it appears on the staff.</p>`,
        visual: h => staffAndKb(h, { notes: ["C4"], interactive: true, mark: [60] }),
      },
      {
        title: "Higher on the staff = further right",
        html: `<p>The same letter appears in many places. <b>C4</b> and <b>C5</b> are both C, one octave apart.</p>
               <p>The higher a note sits on the staff, the further <b>up</b> (right) the key is on the keyboard.</p>`,
        visual: h => staffAndKb(h, { notes: ["C4", "C5"], mark: [60, 72] }),
      },
      {
        title: "Your landmarks",
        html: `<p>Don't count lines every time. Use landmarks and step from them:</p>
               <ul class="ins"><li><b>C4</b> — middle C, one ledger line below</li><li><b>G4</b> — line 2, where the clef curls</li>
               <li><b>B4</b> — the middle line</li><li><b>B3</b> and <b>B5</b> — just outside the staff</li></ul>`,
        visual: h => staffAndKb(h, { notes: ["B3", "C4", "G4", "B4", "B5"], mark: [59, 60, 67, 71, 83] }),
      },
    ],
    levels: [
      { id: "3.1", type: "staff", title: "Line notes", desc: "E G B D F — find each one on the keyboard, any finger.", tasks: 12,
        make: ctx => plainTask(ctx, LINE_KEYS), itemKeys: () => LINE_KEYS },
      { id: "3.2", type: "staff", title: "Space notes", desc: "F A C E — any finger.", tasks: 12,
        make: ctx => plainTask(ctx, SPACE_KEYS), itemKeys: () => SPACE_KEYS },
      { id: "3.3", type: "staff", title: "The whole staff", desc: "E4 to F5, lines and spaces — any finger.", tasks: 12,
        make: ctx => plainTask(ctx, STAFF_KEYS), itemKeys: () => STAFF_KEYS },
      { id: "3.4", type: "staff", title: "With ledger lines", desc: "C4 to B5 — any finger.", tasks: 12,
        make: ctx => plainTask(ctx, KEYS), itemKeys: () => KEYS },
      { id: "3.5", type: "staff", timed: true, optional: true, pass: { minScore: 20 }, title: "60-second challenge",
        desc: "How many notes can you find in a minute? Optional. Pass: 20.", make: ctx => plainTask(ctx, KEYS), itemKeys: () => KEYS },
    ],
  },
  {
    id: "4",
    title: "Fingering",
    blurb: "Finger numbers on the staff, hand positions, moving the hand, double notes.",
    steps: [
      {
        title: "Finger numbers on the staff",
        html: `<p>Sheet music often has a small <b>number above a note</b>. It tells you <b>which finger</b> to use: 1 = thumb … 5 = pinky, the same numbers you learned in Lesson 1.</p>
               <p>From now on the finger matters, not just the key.</p>`,
        visual: h => staffAndKb(h, { elems: [{ keys: ["E4"], finger: 3 }], mark: [64] }),
      },
      {
        title: "Right-hand position",
        html: `<p>Put your <b>right thumb (1) on middle C</b>. Fingers 2, 3, 4, 5 rest on D, E, F, G. This is the <b>C position</b> — one finger per key.</p>
               <p>Move the whole hand up so the thumb sits on G4 and you're in the <b>G position</b> (G A B C D).</p>
               <p class="muted">In sheet music, small numbers above the notes tell you which finger to use.</p>`,
        visual: h => staffAndKb(h, { elems: ["C4", "D4", "E4", "F4", "G4"].map((k, i) => ({ keys: [k], finger: i + 1 })), mark: [60, 62, 64, 65, 67] }),
      },
      {
        title: "Moving the hand",
        html: `<p>When a melody leaves your five keys, the hand moves — and a <b>new finger number</b> shows where it lands. Notes without a number stay in the same position.</p>
               <p>Move as little as possible: going <b>up</b>, the <b>pinky</b> reaches the new note; going <b>down</b>, the <b>thumb</b> does. When the hand moves, the new position lights up on the keyboard.</p>`,
        visual: h => staffAndKb(h, { elems: [{ keys: ["C4"], finger: 1 }, { keys: ["E4"] }, { keys: ["A4"], finger: 5 }, { keys: ["G4"] }], mark: [64, 65, 67, 69, 62] }),
      },
      {
        title: "Two notes at once",
        html: `<p>When two notes are stacked on <b>one stem</b>, play them <b>together</b>, at the same moment.</p>
               <p>Use two fingers of the right hand — for example <b>C4 + E4</b> with fingers <b>1 and 3</b>, or <b>C4 + G4</b> with <b>1 and 5</b>.</p>`,
        visual: h => staffAndKb(h, { elems: [{ keys: ["C4", "E4"] }, { keys: ["D4", "F4"] }, { keys: ["C4", "G4"] }], mark: [60, 64] }),
      },
    ],
    levels: [
      { id: "4.1", type: "staff", title: "With fingering", desc: "One note at a time, the finger number written above it.", tasks: 12,
        make: ctx => singleTask(ctx, true), itemKeys: () => KEYS },
      { id: "4.2", type: "staff", title: "Five-finger positions", desc: "4 notes in C or G position, fingers written above.", tasks: 6,
        make: ctx => phraseTask(ctx, ["C4", "G4"]), itemKeys: () => KEYS },
      { id: "4.3", type: "staff", title: "Read ahead", desc: "4 notes with steps and leaps; fingers written only where the hand moves.", tasks: 6,
        make: ctx => leapTask(ctx), itemKeys: () => KEYS },
      { id: "4.4", type: "staff", title: "Double notes", desc: "Two notes together, one chord at a time.", tasks: 10, pass: { maxMs: 3000 },
        make: ctx => dyadTask(ctx, 1), itemKeys: () => DYADS },
    ],
  },
  {
    id: "5",
    title: "Tempo",
    blurb: "The beat, bars in 4/4, and the classic tempo words: Lento, Andante, Moderato, Allegro.",
    steps: [
      {
        title: "The beat",
        html: `<p>Music has a steady pulse called the <b>beat</b> — what you tap your foot to.</p>
               <p>A <b>metronome</b> clicks the beat for you, always at the same speed.</p>
               <button class="primary ghost" data-act="hear">▶ Hear a slow beat</button>`,
        visual: (h, root) => beatDemo(h, root, { bpm: 54, timeSig: false }),
      },
      {
        title: "Bars and 4/4",
        html: `<p>Music is split into <b>bars</b> (measures), separated by bar lines. <b>4/4</b> at the start means <b>4 beats in every bar</b>.</p>
               <p>A filled note with a stem is a <b>quarter note</b>: it lasts one beat. A bar of 4/4 holds 4 quarter notes — count them “1, 2, 3, 4”.</p>
               <button class="primary ghost" data-act="hear">▶ Hear it</button>`,
        visual: (h, root) => beatDemo(h, root, { bpm: 54, timeSig: true }),
      },
      {
        title: "Tempo words",
        html: `<p>How fast the beat goes is the <b>tempo</b>. Composers write it in Italian, above the first bar:</p>
               <div class="tempi">${TEMPI.map(t => `<div class="tempo"><b>${t.name}</b><span>${t.meaning}</span><small>about ${t.range} beats per minute</small>
                 <button class="mini" data-tempo="${t.bpm}">▶ Hear</button></div>`).join("")}</div>
               <p class="muted">The numbers are only a guide — the word tells you the character. Other words you'll meet: <i>Largo</i> (very slow), <i>Adagio</i> (slow, between Lento and Andante), <i>Presto</i> (very fast).</p>`,
        visual: (h, root) => tempoDemo(h, root),
      },
      {
        title: "Count in, then play",
        html: `<p>Every bar starts with <b>4 clicks to count in</b>. Then play <b>one note on each click</b>.</p>
               <ul class="ins"><li>During the count-in the <b>hand position lights up</b> — put your hand there.</li>
               <li>Keep your eyes <b>one note ahead</b> of your fingers.</li>
               <li>Missed a note? <b>Don't stop</b> — catch the next click.</li>
               <li>In <b>Moderato</b> and <b>Allegro</b> you play a pattern you already know, so you can think about the beat, not the notes.</li></ul>`,
        visual: h => staffAndKb(h, { elems: ["C4", "D4", "E4", "F4"].map((k, i) => ({ keys: [k], finger: i + 1 })), timeSig: true, mark: [60, 62, 64, 65, 67] }),
      },
      {
        title: "Two notes in time",
        html: `<p>Double notes work the same way: <b>both notes together, on the click</b>. We do them in <b>Lento</b>.</p>`,
        visual: h => staffAndKb(h, { elems: [{ keys: ["C4", "E4"], finger: [1, 3] }, { keys: ["D4", "F4"], finger: [2, 4] }, { keys: ["E4", "G4"], finger: [3, 5] }, { keys: ["C4", "E4"], finger: [1, 3] }], timeSig: true, mark: [] }),
      },
    ],
    levels: [
      { id: "5.1", type: "staff", tempo: true, bpm: 54, tempoWord: "Lento", title: "Keep the beat · Lento", desc: "One note per bar, played on all 4 clicks.", tasks: 7,
        make: ctx => repeatTask(ctx), itemKeys: () => KEYS },
      { id: "5.2", type: "staff", tempo: true, bpm: 54, tempoWord: "Lento", title: "Steps in time · Lento", desc: "4 new notes per bar in a five-finger position.", tasks: 7,
        make: ctx => phraseTask(ctx, ["C4", "D4", "E4", "F4", "G4", "A4"]), itemKeys: () => KEYS },
      { id: "5.3", type: "staff", tempo: true, bpm: 80, tempoWord: "Andante", title: "Steps in time · Andante", desc: "The same at a walking pace.", tasks: 7,
        make: ctx => phraseTask(ctx, ["C4", "D4", "E4", "F4", "G4", "A4"]), itemKeys: () => KEYS },
      { id: "5.4", type: "staff", tempo: true, bpm: 108, tempoWord: "Moderato", title: "Up and down · Moderato", desc: "A known pattern: 1 2 3 4 · 5 4 3 2 in C or G position.", tasks: 8,
        make: ctx => patternTask(ctx), itemKeys: () => KEYS },
      { id: "5.5", type: "staff", tempo: true, bpm: 126, tempoWord: "Allegro", title: "Up and down · Allegro", desc: "The same pattern, fast and lively.", tasks: 8,
        make: ctx => patternTask(ctx), itemKeys: () => KEYS },
      { id: "5.6", type: "staff", tempo: true, bpm: 54, tempoWord: "Lento", title: "Double notes · Lento", desc: "4 double notes per bar.", tasks: 7, pass: { maxMs: 200 },
        make: ctx => dyadTask(ctx, 4), itemKeys: () => DYADS },
    ],
  },
  {
    id: "6",
    title: "Bass clef",
    blurb: "The left hand's staff: the F clef, G B D F A, A C E G, and the grand staff.",
    steps: [
      {
        title: "Two clefs, two hands",
        html: `<p>Piano music uses <b>two staves</b>: the <b>treble clef</b> on top (usually the right hand) and the <b>bass clef</b> below (usually the left hand). Together they make the <b>grand staff</b>.</p>
               <p><b>Middle C (C4)</b> sits right between them: one ledger line <b>below</b> the treble staff, or one ledger line <b>above</b> the bass staff — it's the same key.</p>`,
        visual: h => grandStaff(h, [{ key: "C4", clef: "treble" }, { key: "C4", clef: "bass" }]),
      },
      {
        title: "The bass clef",
        html: `<p>The bass clef is also called the <b>F clef</b>. Its two dots sit around <b>line 4</b> (from the bottom), and that line is <b>F3</b> — the F below middle C.</p>
               <p>Like before, every step up — line, space, line — is the next letter.</p>`,
        visual: h => staffVisual(h, ["F3"], { clef: "bass", mark: "F3" }),
      },
      {
        title: "Line notes: G B D F A",
        html: `<p>The 5 lines, bottom to top, are <b>G B D F A</b>.</p>
               <p>Remember it as <i>"<b>G</b>ood <b>B</b>oys <b>D</b>o <b>F</b>ine <b>A</b>lways"</i>.</p>`,
        visual: h => staffVisual(h, ["G2", "B2", "D3", "F3", "A3"], { clef: "bass", mark: "-" }),
      },
      {
        title: "Space notes: A C E G",
        html: `<p>The 4 spaces, bottom to top, are <b>A C E G</b>.</p>
               <p>Remember it as <i>"<b>A</b>ll <b>C</b>ows <b>E</b>at <b>G</b>rass"</i>.</p>`,
        visual: h => staffVisual(h, ["A2", "C3", "E3", "G3"], { clef: "bass", mark: "-" }),
      },
      {
        title: "Same place, different note",
        html: `<p>Careful: the same spot means a <b>different note</b> in each clef. The bottom line is <b>E</b> in treble but <b>G</b> in bass.</p>
               <p>A handy trick: a bass note is <b>two letters later</b> than the treble note in the same place — E→G, F→A, G→B…</p>`,
        visual: h => { staffVisual(h, ["E4", "F4", "G4", "A4"], { mark: "-" }); staffVisual(h, ["G2", "A2", "B2", "C3"], { clef: "bass", mark: "-" }); return {}; },
      },
      {
        title: "Ledger lines",
        html: `<p>Above the bass staff: <b>B3</b> sits just above the top line, <b>C4 (middle C)</b> is on a ledger line, <b>D4</b> sits above it.</p>
               <p>Below: <b>F2</b> hangs under the bottom line, <b>E2</b> is on a ledger line, <b>D2</b> hangs under it.</p>`,
        visual: h => staffVisual(h, ["D2", "E2", "F2", "B3", "C4", "D4"], { clef: "bass", mark: "C4" }),
      },
      {
        title: "The full map: D2 → D4",
        html: `<p>All 15 notes you'll practise. Landmarks: <b>F3</b> (the clef's line), <b>D3</b> on the middle line, and <b>middle C</b> on the ledger line above.</p>`,
        visual: h => { staffVisual(h, BASS.slice(0, 7).map(n => n.key), { clef: "bass", mark: "F3" }); staffVisual(h, BASS.slice(7).map(n => n.key), { clef: "bass", mark: "C4" }); return {}; },
      },
    ],
    levels: [
      { id: "6.1", type: "notes", clef: "bass", title: "Line notes", desc: "G B D F A only.", pass: { maxMs: 1000 }, keys: ["G2", "B2", "D3", "F3", "A3"] },
      { id: "6.2", type: "notes", clef: "bass", title: "Space notes", desc: "A C E G only.", pass: { maxMs: 1000 }, keys: ["A2", "C3", "E3", "G3"] },
      { id: "6.3", type: "notes", clef: "bass", title: "The whole staff", desc: "G2 to A3, lines and spaces.", keys: BASS.filter(n => n.step >= 0 && n.step <= 8).map(n => n.key) },
      { id: "6.4", type: "notes", clef: "bass", title: "With ledger lines", desc: "Full range D2 to D4.", keys: BASS.map(n => n.key) },
      { id: "6.5", type: "notes", clef: "bass", optional: true, title: "60-second challenge", desc: "How many can you name in a minute? Optional. Pass: 25.", keys: BASS.map(n => n.key), timed: true },
    ],
  },
  {
    id: "7",
    title: "Left hand on the keyboard",
    blurb: "See a note in the bass clef, find it with the left hand — any finger.",
    steps: [
      {
        title: "One note, one key — left hand",
        html: `<p>The bass clef works just like the treble clef: every note is <b>exactly one key</b>, now in the lower half of the keyboard.</p>
               <p><b>Try it:</b> play any white key from D2 to D4 and watch where it appears on the bass staff.</p>`,
        visual: h => staffAndKb(h, { notes: ["C3"], interactive: true, mark: [48], clef: "bass" }),
      },
      {
        title: "Higher on the staff = further right",
        html: `<p><b>C3</b> and <b>C4</b> are both C, one octave apart. Higher on the staff is further <b>up</b> (right) on the keyboard — same as in the treble clef.</p>`,
        visual: h => staffAndKb(h, { notes: ["C3", "C4"], mark: [48, 60], clef: "bass" }),
      },
      {
        title: "Your left-hand landmarks",
        html: `<ul class="ins"><li><b>G2</b> — the bottom line</li><li><b>C3</b> — the second space</li>
               <li><b>F3</b> — line 4, between the clef's dots</li><li><b>C4</b> — middle C, the ledger line above</li></ul>
               <p class="muted">The left hand plays from middle C down.</p>`,
        visual: h => staffAndKb(h, { notes: ["G2", "C3", "F3", "C4"], mark: [43, 48, 53, 60], clef: "bass" }),
      },
    ],
    levels: [
      { id: "7.1", type: "staff", clef: "bass", hand: "L", title: "Line notes", desc: "G B D F A — find each one, any left-hand finger.", tasks: 12,
        make: ctx => plainTask(ctx, L_LINE_KEYS), itemKeys: () => L_LINE_KEYS },
      { id: "7.2", type: "staff", clef: "bass", hand: "L", title: "Space notes", desc: "A C E G — any finger.", tasks: 12,
        make: ctx => plainTask(ctx, L_SPACE_KEYS), itemKeys: () => L_SPACE_KEYS },
      { id: "7.3", type: "staff", clef: "bass", hand: "L", title: "The whole staff", desc: "G2 to A3 — any finger.", tasks: 12,
        make: ctx => plainTask(ctx, L_STAFF_KEYS), itemKeys: () => L_STAFF_KEYS },
      { id: "7.4", type: "staff", clef: "bass", hand: "L", title: "With ledger lines", desc: "D2 to middle C — any finger.", tasks: 12,
        make: ctx => plainTask(ctx, LKEYS), itemKeys: () => LKEYS },
      { id: "7.5", type: "staff", clef: "bass", hand: "L", timed: true, optional: true, pass: { minScore: 20 }, title: "60-second challenge",
        desc: "How many notes can you find in a minute? Optional. Pass: 20.", make: ctx => plainTask(ctx, LKEYS), itemKeys: () => LKEYS },
    ],
  },
  {
    id: "8",
    title: "Left-hand fingering",
    blurb: "Finger numbers for the left hand, hand positions, moving the hand, double notes.",
    steps: [
      {
        title: "Left-hand finger numbers",
        html: `<p>The left hand uses the same numbers — <b>1 = thumb … 5 = pinky</b> — but it's mirrored on the keyboard: the <b>pinky (5) plays the lowest note</b> and the <b>thumb (1) the highest</b>.</p>
               <p>So going up a five-finger position, the left hand counts <b>5 4 3 2 1</b>.</p>`,
        visual: h => staffAndKb(h, { elems: ["C3", "D3", "E3", "F3", "G3"].map((k, i) => ({ keys: [k], finger: 5 - i })), mark: [48, 50, 52, 53, 55], clef: "bass" }),
      },
      {
        title: "Left-hand position",
        html: `<p><b>C position:</b> pinky on <b>C3</b>, then 4 3 2 1 on D E F G — the thumb ends on <b>G3</b>.</p>
               <p><b>G position:</b> pinky on <b>G2</b>, thumb on <b>D3</b>.</p>`,
        visual: h => staffAndKb(h, { elems: ["G2", "A2", "B2", "C3", "D3"].map((k, i) => ({ keys: [k], finger: 5 - i })), mark: [43, 45, 47, 48, 50], clef: "bass" }),
      },
      {
        title: "Moving the hand",
        html: `<p>When the melody leaves your five keys, the hand moves and a new finger number shows where it lands. Notes without a number stay in the same position.</p>
               <p>For the left hand it's mirrored: going <b>up</b>, the <b>thumb</b> reaches the new note; going <b>down</b>, the <b>pinky</b> does.</p>`,
        visual: h => staffAndKb(h, { elems: [{ keys: ["C3"], finger: 5 }, { keys: ["E3"] }, { keys: ["A3"], finger: 1 }, { keys: ["G3"] }], mark: [50, 52, 53, 55, 57], clef: "bass" }),
      },
      {
        title: "Two notes at once",
        html: `<p>Same as with the right hand: two notes on one stem are played <b>together</b> — for example <b>C3 + E3</b> with fingers <b>5 and 3</b>.</p>`,
        visual: h => staffAndKb(h, { elems: [{ keys: ["C3", "E3"], finger: [5, 3] }, { keys: ["D3", "F3"], finger: [4, 2] }, { keys: ["E3", "G3"], finger: [3, 1] }], mark: [48, 52], clef: "bass" }),
      },
    ],
    levels: [
      { id: "8.1", type: "staff", clef: "bass", hand: "L", title: "With fingering", desc: "One note at a time, the finger number written above it.", tasks: 12,
        make: ctx => singleTask(ctx, true), itemKeys: () => LKEYS },
      { id: "8.2", type: "staff", clef: "bass", hand: "L", title: "Five-finger positions", desc: "4 notes in C or G position, fingers written above.", tasks: 6,
        make: ctx => phraseTask(ctx, ["C3", "G2"]), itemKeys: () => LKEYS },
      { id: "8.3", type: "staff", clef: "bass", hand: "L", title: "Read ahead", desc: "4 notes with steps and leaps; fingers written only where the hand moves.", tasks: 6,
        make: ctx => leapTask(ctx), itemKeys: () => LKEYS },
      { id: "8.4", type: "staff", clef: "bass", hand: "L", title: "Double notes", desc: "Two notes together, one chord at a time.", tasks: 10, pass: { maxMs: 3000 },
        make: ctx => dyadTask(ctx, 1), itemKeys: () => LDYADS },
    ],
  },
  {
    id: "9",
    title: "Scales and dynamics",
    blurb: "The C major scale with each hand, hands together, contrary motion — then playing evenly, louder and softer.",
    steps: [
      {
        title: "The C major scale",
        html: `<p>A <b>scale</b> walks up the keys one step at a time. <b>C major</b> uses only white keys: <b>C D E F G A B C</b> — one octave, from C to the next C.</p>
               <p>You only have 5 fingers for 8 notes, so the hand has to <b>pass the thumb under</b> or <b>cross a finger over</b> on the way. That's what this lesson is about.</p>`,
        visual: h => staffAndKb(h, { notes: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"], mark: [60, 62, 64, 65, 67, 69, 71, 72] }),
      },
      {
        title: "Right hand: thumb under",
        html: `<p><b>Up</b> from C4: <b>1 2 3</b> on C D E, then the <b>thumb passes under</b> the 3rd finger onto <b>F</b>, and <b>1 2 3 4 5</b> on F G A B C.</p>
               <p><b>Down</b> from C5: <b>5 4 3 2 1</b> on C B A G F, then the <b>3rd finger crosses over</b> the thumb onto <b>E</b>, and <b>3 2 1</b> on E D C.</p>`,
        visual: h => runVisual(h, "rh"),
      },
      {
        title: "Left hand: crossing over",
        html: `<p><b>Up</b> from C3: <b>5 4 3 2 1</b> on C D E F G, then the <b>3rd finger crosses over</b> the thumb onto <b>A3</b>, and <b>3 2 1</b> on A B C.</p>
               <p><b>Down</b> from C4: <b>1 2 3</b> on C B A, then the <b>thumb passes under</b> onto <b>G3</b>, and <b>1 2 3 4 5</b> on G F E D C.</p>`,
        visual: h => runVisual(h, "lh"),
      },
      {
        title: "Hands together, and contrary motion",
        html: `<p><b>Hands together:</b> left hand from C3, right hand from C4, both going up, then down. Tricky: the hands change position at <b>different moments</b> (right hand on F, left hand on A).</p>
               <p><b>Contrary motion:</b> both thumbs start on <b>middle C</b> (it's one key — play it once), then the hands move <b>apart</b> to C5 and C3 and come back. The fingering is a mirror, so both hands cross at the same time — it often feels easier.</p>`,
        visual: h => runVisual(h, "contrary"),
      },
      {
        title: "Loud and soft",
        html: `<p>How loud you play is called <b>dynamics</b>. The words are Italian again: <b><i>p</i></b> (piano) = soft, <b><i>mf</i></b> (mezzo-forte) = medium, <b><i>f</i></b> (forte) = loud.</p>
               <p><b>Crescendo</b> ( &lt; ) means getting louder, <b>diminuendo</b> ( &gt; ) getting softer.</p>
               <p>A digital piano measures <b>how fast you press a key</b> (0–127). This only works with a MIDI piano whose <b>Touch Response</b> setting is not Off. <b>Try it:</b> play a few notes softly, then firmly, and watch the bar.</p>`,
        visual: h => velocityVisual(h),
      },
    ],
    levels: [
      { id: "9.1", type: "scale", run: "rh", title: "Right hand", desc: "C4 up to C5 and back — thumb under on F, 3 over on E.", pass: { maxMs: 2000 },
        hint: "Right hand · fingers written above the notes" },
      { id: "9.2", type: "scale", run: "lh", title: "Left hand", desc: "C3 up to C4 and back — 3 over on A, thumb under on G.", pass: { maxMs: 2000 },
        hint: "Left hand · fingers written above the notes" },
      { id: "9.3", type: "scale", run: "both", title: "Hands together", desc: "Left hand from C3, right hand from C4, up and down together.", pass: { maxMs: 2000 },
        hint: "Both hands, each pair of notes together" },
      { id: "9.4", type: "scale", run: "contrary", title: "Contrary motion", desc: "Both thumbs on middle C, hands move apart and back.", pass: { maxMs: 2000 },
        hint: "Start with both thumbs on middle C (one key), then move apart" },
      { id: "9.5", type: "scale", run: "contrary", dyn: "even", title: "Even touch", desc: "Contrary motion, every note the same loudness. MIDI piano only.", pass: { maxMs: 2000 },
        hint: "<b><i>mf</i></b> all the way — every note equally loud" },
      { id: "9.6", type: "scale", run: "contrary", dyn: "cresc", title: "Soft – loud – soft", desc: "Crescendo on the way out, diminuendo on the way back. MIDI piano only.", pass: { maxMs: 2000 },
        hint: "<b><i>p</i></b> &lt; <b><i>f</i></b> &gt; <b><i>p</i></b> — grow louder going out, softer coming back" },
      { id: "9.7", type: "scale", run: "contrary", dyn: "dim", title: "Loud – soft – loud", desc: "Diminuendo on the way out, crescendo on the way back. MIDI piano only.", pass: { maxMs: 2000 },
        hint: "<b><i>f</i></b> &gt; <b><i>p</i></b> &lt; <b><i>f</i></b> — softer going out, louder coming back" },
    ],
  },
];

// ---------- Lesson 5 helpers ----------
const EXAMPLE = ["C4", "D4", "E4", "F4", "G4", "F4", "E4", "D4"];

// Tempo words step: each button plays the same little tune at that tempo.
function tempoDemo(h, root) {
  const { groups, cleanup } = staffAndKb(h, { elems: EXAMPLE.map(k => ({ keys: [k] })), timeSig: true, mark: [] });
  let raf = null;
  root.querySelectorAll("[data-tempo]").forEach(btn => btn.onclick = () => {
    audio(); stopClicks(); cancelAnimationFrame(raf);
    root.querySelectorAll(".tempo").forEach(t => t.classList.toggle("on", t.contains(btn)));
    const { t0Perf, beatMs } = playMelody(EXAMPLE.map(k => midiOf(k[0], +k.slice(1))), +btn.dataset.tempo);
    const tick = () => {
      const b = Math.floor((performance.now() - t0Perf) / beatMs) - 4;
      groups.forEach((g, i) => colorChord(g, i === b ? "#3d5a80" : "#1d1b18"));
      if (b < EXAMPLE.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  return { cleanup: () => { cancelAnimationFrame(raf); stopClicks(); cleanup(); } };
}

// 5.4 / 5.5: a pattern you know — up 1 2 3 4, then down 5 4 3 2 — so the tempo is the only challenge.
function patternTask(ctx) {
  const st = ctx.state;
  if (st.p == null || st.up === false) {
    if (st.p == null || Math.random() < 0.5) st.p = KEYS.indexOf(Math.random() < 0.5 ? "C4" : "G4");
  }
  const up = st.up = !st.up;
  const idx = up ? [0, 1, 2, 3] : [4, 3, 2, 1];
  const moved = up && st.lastP !== st.p; st.lastP = st.p;
  return {
    pos: { thumb: st.p, moved, fingers: fingerMap(RP, st.p) },
    elems: idx.map(i => ({ keys: [KEYS[st.p + i]], item: KEYS[st.p + i], finger: i + 1 })),
    sub: `Thumb on <b>${KEYS[st.p]}</b> · ${up ? "up: 1 2 3 4" : "down: 5 4 3 2"}`,
  };
}

// ---------- Lesson 3 helpers ----------
// Right hand only, so the range starts at middle C (B3 belongs to the left hand).
const KEYS = TREBLE.filter(n => n.key !== "B3").map(n => n.key);   // C4 … B5
const DYADS = [];
KEYS.forEach((k, i) => [2, 3, 4].forEach(d => { if (KEYS[i + d]) DYADS.push(k + "+" + KEYS[i + d]); }));
const LINE_KEYS = ["E4", "G4", "B4", "D5", "F5"];
const SPACE_KEYS = ["F4", "A4", "C5", "E5"];
const STAFF_KEYS = ["E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5"];

// Left hand: bass clef up to middle C (D4 belongs to the right hand).
const LKEYS = BASS.filter(n => n.key !== "D4").map(n => n.key);    // D2 … C4
const LDYADS = [];
LKEYS.forEach((k, i) => [2, 3, 4].forEach(d => { if (LKEYS[i + d]) LDYADS.push(k + "+" + LKEYS[i + d]); }));
const L_LINE_KEYS = ["G2", "B2", "D3", "F3", "A3"];
const L_SPACE_KEYS = ["A2", "C3", "E3", "G3"];
const L_STAFF_KEYS = ["G2", "A2", "B2", "C3", "D3", "E3", "F3", "G3", "A3"];

// 3.1–3.4: just find the note on the keyboard — no hand position, no fingering.
function plainTask(ctx, keys) {
  const k = pick(ctx.es, keys, ctx.prev);
  return { elems: [{ keys: [k], item: k }], sub: "Find it on the keyboard — any finger." };
}

// How likely each melodic interval is (in steps). Mostly steps and small skips, like real tunes.
const STEP_W = { 0: 0.15, 1: 3, 2: 2.2, 3: 1.2, 4: 0.8 };
const LEAP_W = { 0: 0.1, 1: 2.5, 2: 2.4, 3: 1.8, 4: 1.4, 5: 1, 6: 0.6, 7: 0.5 };
const diff = (ctx, k) => Math.pow(difficulty(ctx.es, k), 1.5);

function weighted(items, weights) {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

// ---------- hand profiles ----------
// A five-finger position is described by p = index of its LOWEST key in P.keys.
// Right hand: thumb is the lowest finger (1 … 5 going up). Left hand: pinky is the lowest (5 … 1 going up).
const RP = { hand: "R", keys: KEYS, f: (j, p) => j - p + 1, thumb: p => KEYS[p] };
const LP = { hand: "L", keys: LKEYS, f: (j, p) => 5 - (j - p), thumb: p => LKEYS[p + 4] };
const prof = ctx => (ctx.hand === "L" ? LP : RP);
const maxP = P => P.keys.length - 5;
const fingerMap = (P, p) => Object.fromEntries([0, 1, 2, 3, 4].map(i => [P.keys[p + i], P.f(p + i, p)]));
const where = (P, p) => `Hand position: thumb on <b>${P.thumb(p)}</b>`;

// Pick a hand position, leaning toward positions that hold your hard notes.
function choosePos(ctx, options, near) {
  const P = prof(ctx);
  const w = options.map(p => {
    let d = 0; for (let j = p; j < p + 5; j++) d += diff(ctx, P.keys[j]);
    const move = near == null ? 1 : [1, 1.4, 1.1, 0.7, 0.4][Math.min(4, Math.abs(p - near))];
    return d * move;
  });
  return weighted(options, w);
}

// Next note inside the current position: mostly steps/skips, hard notes a bit more often.
function nextInPos(ctx, p, last) {
  const P = prof(ctx);
  const cand = [0, 1, 2, 3, 4].map(f => p + f);
  const w = cand.map(j => (last == null ? 1 : STEP_W[Math.min(4, Math.abs(j - last))]) * diff(ctx, P.keys[j]));
  return weighted(cand, w);
}

// With fingering: one note per task, consecutive tasks form a flowing line in one hand position.
// The hand moves now and then — the task says so.
function singleTask(ctx, fingering) {
  const P = prof(ctx), st = ctx.state;
  let moved = false;
  if (st.p == null) { st.p = choosePos(ctx, range(0, maxP(P))); moved = true; st.n = 0; }
  else if (st.n >= 4 && Math.random() < 0.3) {
    st.p = choosePos(ctx, range(0, maxP(P)).filter(p => p !== st.p), st.p); moved = true; st.n = 0; st.last = null;
  }
  const j = nextInPos(ctx, st.p, st.last);
  st.last = j; st.n++;
  const k = P.keys[j], f = P.f(j, st.p);
  return {
    pos: { thumb: st.p, moved, fingers: fingerMap(P, st.p) },
    elems: [{ keys: [k], item: k, finger: fingering ? f : null }],
    sub: (moved ? `<span class="handline">↔ ${where(P, st.p)}</span>` : `<span class="muted">${where(P, st.p)}</span>`) +
         (fingering ? ` · <b>${handWords(P.hand, f)}</b>` : ""),
  };
}

// Five-finger positions: a 4-note phrase in one position. starts = lowest key of each allowed position.
function phraseTask(ctx, starts) {
  const P = prof(ctx);
  const options = starts.map(k => P.keys.indexOf(k));
  const p = choosePos(ctx, options);
  const moved = ctx.state.p !== p; ctx.state.p = p;
  const elems = []; let last = null;
  for (let i = 0; i < 4; i++) {
    const j = nextInPos(ctx, p, last); last = j;
    elems.push({ keys: [P.keys[j]], item: P.keys[j], finger: P.f(j, p) });
  }
  return { pos: { thumb: p, moved, fingers: fingerMap(P, p) }, elems,
    sub: `Thumb on <b>${P.thumb(p)}</b> · five fingers on ${P.keys.slice(p, p + 5).join(" ")}` };
}

// Read ahead: steps and leaps across the whole range, continuing from the previous phrase.
// Like real sheet music, a finger number is written only where the hand has to move
// (and on the first note); in between you stay in the same five-finger position.
function leapTask(ctx) {
  const P = prof(ctx), st = ctx.state;
  const elems = [];
  let leaps = 0, lastMove = 0;      // lastMove: signed interval of the previous note
  for (let i = 0; i < 4; i++) {
    const cand = range(0, P.keys.length - 1);
    const w = cand.map(j => {
      if (st.last == null) return diff(ctx, P.keys[j]);
      const d = j - st.last, a = Math.abs(d);
      let wt = LEAP_W[a] || 0.1;
      if (a > 2 && leaps >= 1) wt = 0;                        // at most one leap per phrase
      if (Math.abs(lastMove) > 2) {                           // after a leap: a step or small skip…
        wt = a <= 2 && a > 0 ? wt * (Math.sign(d) !== Math.sign(lastMove) ? 3 : 1) : 0;   // …preferably back
      }
      return wt * diff(ctx, P.keys[j]);
    });
    const j = weighted(cand, w);
    if (st.last != null) { lastMove = j - st.last; if (Math.abs(lastMove) > 2) leaps++; }
    let moved = false;
    if (st.p == null || j < st.p || j > st.p + 4) {
      // move the hand as little as possible: the top finger reaches a higher note,
      // the bottom finger reaches a lower one (right hand: pinky / thumb, left hand: thumb / pinky)
      if (st.p == null) st.p = Math.max(0, Math.min(j - 2, maxP(P)));   // start with the note under the middle finger
      else if (j > st.p + 4) st.p = Math.min(j - 4, maxP(P));
      else st.p = Math.max(j, 0);
      moved = true;
    }
    st.last = j;
    elems.push({ keys: [P.keys[j]], item: P.keys[j], finger: moved || i === 0 ? P.f(j, st.p) : null });
  }
  return { elems, sub: "A finger number appears only where your hand moves — stay in that position until the next number." };
}

// Double notes that fit one hand position, with fingering, moving smoothly.
function dyadTask(ctx, count) {
  const P = prof(ctx), st = ctx.state;
  let moved = false;
  if (st.p == null || (st.n >= 4 && Math.random() < 0.35)) {
    st.p = choosePos(ctx, range(0, maxP(P)), st.p); st.n = 0; st.last = null; moved = true;
  }
  const elems = [];
  for (let i = 0; i < count; i++) {
    const cand = [];
    for (let lo = st.p; lo <= st.p + 2; lo++) for (const d of [2, 3, 4]) if (lo + d <= st.p + 4) cand.push([lo, lo + d]);
    const w = cand.map(([a, b]) => (st.last == null ? 1 : [0.3, 3, 2, 1][Math.min(3, Math.abs(a - st.last))]) * diff(ctx, P.keys[a] + "+" + P.keys[b]));
    const [a, b] = weighted(cand, w);
    st.last = a; st.n++;
    elems.push({ keys: [P.keys[a], P.keys[b]], item: P.keys[a] + "+" + P.keys[b], finger: [P.f(a, st.p), P.f(b, st.p)] });
  }
  return { pos: { thumb: st.p, moved, fingers: fingerMap(P, st.p) }, elems,
    sub: `Thumb on <b>${P.thumb(st.p)}</b> · both notes together, fingers written above` };
}

// 4.1: one note per bar, played on all 4 beats — pure timing, nothing else to think about.
function repeatTask(ctx) {
  const options = ["C4", "D4", "E4", "F4", "G4", "A4"].map(k => KEYS.indexOf(k));
  const p = choosePos(ctx, options);
  const moved = ctx.state.p !== p; ctx.state.p = p;
  const j = nextInPos(ctx, p, null), k = KEYS[j], f = j - p + 1;
  return { pos: { thumb: p, moved, fingers: fingerMap(RP, p) }, elems: [0, 1, 2, 3].map(i => ({ keys: [k], item: k, finger: i === 0 ? f : null })),
    sub: `Thumb on <b>${KEYS[p]}</b> · the same note 4 times` };
}

// Metronome demo for the Lesson 4 steps: clicks, and the beat lights up on the staff.
function beatDemo(h, root, { bpm, timeSig }) {
  const elems = ["C4", "D4", "E4", "F4"].map(k => ({ keys: [k] }));
  const { groups, cleanup } = staffAndKb(h, { elems, timeSig, mark: [] });
  let raf = null;
  root.querySelector('[data-act="hear"]').onclick = () => {
    audio(); stopClicks(); cancelAnimationFrame(raf);
    const { t0Perf, beatMs } = schedule(8, bpm);
    const tick = () => {
      const b = Math.floor((performance.now() - t0Perf) / beatMs) - 4;
      groups.forEach((g, i) => colorChord(g, i === b ? "#3d5a80" : "#1d1b18"));
      if (b < 4) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  return { cleanup: () => { cancelAnimationFrame(raf); stopClicks(); cleanup(); } };
}

// Lesson 9 visuals: the whole scale run with fingering, and a live loudness meter.
function runVisual(h, run) {
  const card = document.createElement("div");
  card.className = "card staff scale";
  h.appendChild(card);
  drawRun(card, buildRun(run), { grand: run !== "rh" });
  const v = kbVisual(h, { lo: run === "rh" ? 57 : 46, hi: run === "lh" ? 62 : 74, labels: "c" });
  return { cleanup: () => v.cleanup() };
}

function velocityVisual(h) {
  const box = document.createElement("div");
  box.className = "card velbox big";
  box.innerHTML = `<div class="muted">Loudness of the last note</div><div class="velmeter"><div></div></div><div class="velnum">–</div>`;
  h.appendChild(box);
  const v = kbVisual(h, { lo: 48, hi: 72, labels: "c" });
  const off = onNote((m, src, vel) => {
    if (vel == null) { box.querySelector(".velnum").textContent = "tapped on screen — no loudness"; return; }
    box.querySelector(".velmeter > div").style.width = (vel / 127 * 100) + "%";
    box.querySelector(".velnum").textContent = `${vel} / 127 · ${vel < 50 ? "p (soft)" : vel < 85 ? "mf (medium)" : "f (loud)"}`;
  });
  return { cleanup: () => { off(); v.cleanup(); } };
}

function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

function staffAndKb(h, { notes = null, elems = null, timeSig = false, mark = [], interactive = false, clef = "treble" }) {
  const MAP = byClef(clef);
  const card = document.createElement("div");
  card.className = "card staff";
  h.appendChild(card);
  let groups = [];
  const drawElems = list => {
    card.innerHTML = "";
    const svg = svgEl("0 0 300 180");
    card.appendChild(svg);
    groups = drawMeasure(svg, list.map(e => ({ steps: e.keys.map(k => MAP[k].step), finger: e.finger })), { timeSig, clef });
  };
  drawElems(elems || notes.map(k => ({ keys: [k] })));
  const v = kbVisual(h, { lo: clef === "bass" ? 36 : 57, hi: clef === "bass" ? 62 : 84, labels: interactive ? "none" : "c", info: true,
    mark: kb => { mark.forEach(m => kb.set(m, "target")); } });
  let off = () => {};
  if (interactive) {
    off = onNote(m => {
      const k = nameOf(m);
      if (MAP[k]) drawElems([{ keys: [k] }]);
    });
  }
  return { groups, cleanup: () => { off(); v.cleanup(); } };
}
