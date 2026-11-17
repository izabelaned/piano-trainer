// Lesson content: teaching steps + exercise levels.
import { LETTERS, SOLF, SIZES, MIDDLE_C, TREBLE, keysOfLetter, nameOf, isWhite, letterOf, midiOf, FINGER_NAMES } from "./music.js";
import { Keyboard } from "./keyboard.js";
import { onNote, connectMidi, onMidiStatus, midiStatusText } from "./input.js";
import { drawStaff, drawNote, svgEl, el, yOf, drawMeasure, colorChord } from "./staff.js";
import { schedule, audio } from "./metronome.js";
import { store, save } from "./store.js";
import { pick } from "./engine.js";

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
    if (info) line.innerHTML = `You played <b>${nameOf(m)}</b>${letterOf(m) ? " · " + SOLF[letterOf(m)] : ""}`;
    kb.flash(m, "ok", 350);
  });
  return { kb, cleanup: () => { off(); kb.destroy(); } };
}

const namesTable = () => `<table class="names">
  <tr><th>English</th>${LETTERS.map(L => `<td>${L}</td>`).join("")}</tr>
  <tr><th>Български</th>${LETTERS.map(L => `<td>${SOLF[L]}</td>`).join("")}</tr></table>`;

function staffVisual(host, notes, { clef = true, numbers = false, width = 360 } = {}) {
  const svg = svgEl(`0 40 ${width} 172`);
  drawStaff(svg, { x1: 6, x2: width - 6, clef });
  if (numbers) for (let i = 0; i < 5; i++) el("text", { x: width - 14, y: yOf(i * 2) + 4, "font-size": 10, fill: "#7a746b", "text-anchor": "middle" }, svg).textContent = i + 1;
  const x0 = clef ? 92 : 50, dx = Math.min(36, (width - x0 - 30) / Math.max(1, notes.length - 1));
  notes.forEach((key, i) => {
    const n = TREBLE.find(t => t.key === key), x = x0 + i * dx;
    const c = n.letter === "B" ? "#3d5a80" : "#1d1b18";
    drawNote(svg, n.step, x, { color: c, stem: false });
    el("text", { x, y: 182, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: c }, svg).textContent = key;
    el("text", { x, y: 200, "text-anchor": "middle", "font-size": 12, fill: "#7a746b" }, svg).textContent = SOLF[n.letter];
  });
  const card = document.createElement("div");
  card.className = "card staff";
  card.appendChild(svg);
  host.appendChild(card);
  return {};
}

function handsSvg() {
  const finger = (x, h, n, w = 22) => `<rect x="${x}" y="${100 - h}" width="${w}" height="${h}" rx="11" fill="#f3d9c4" stroke="#b98d6c"/>
    <text x="${x + w / 2}" y="${100 - h + 18}" text-anchor="middle" font-size="14" font-weight="700" fill="#1d1b18">${n}</text>`;
  const palm = x => `<rect x="${x}" y="92" width="128" height="60" rx="24" fill="#f3d9c4" stroke="#b98d6c"/>`;
  // left hand (palm down): pinky on the left, thumb on the right
  const L = palm(14) + finger(14, 50, 5) + finger(40, 70, 4) + finger(66, 78, 3) + finger(92, 70, 2) + finger(128, 36, 1, 24);
  const R = palm(218) + finger(206, 36, 1, 24) + finger(244, 70, 2) + finger(270, 78, 3) + finger(296, 70, 4) + finger(322, 50, 5);
  return `<svg viewBox="0 0 360 170" class="hands">${L}${R}
    <text x="78" y="168" text-anchor="middle" font-size="12" fill="#7a746b">Left hand (LH)</text>
    <text x="282" y="168" text-anchor="middle" font-size="12" fill="#7a746b">Right hand (RH)</text></svg>`;
}

// ---------- Lesson 1 exercise generators ----------
const handTxt = (h, f) => `${h === "R" ? "Right hand" : "Left hand"} · finger ${f} (${FINGER_NAMES[f]})`;
const handShort = (h, f) => `${h}H ${f}`;
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
const letterLabel = k => (store.settings.solf ? SOLF[k] + " (" + k + ")" : k);

function namesTask(ctx, k, extraSub) {
  const L = pick(ctx.es, LETTERS, ctx.prev);
  const ks = keysOfLetter(L, ctx.lo, ctx.hi);
  const chosen = shuffle(ks).slice(0, Math.min(k, ks.length)).sort((a, b) => a - b);
  const names = chosen.map(nameOf);
  const list = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
  return {
    item: L,
    prompt: `Play <b>${list}</b>`,
    sub: "Any order. The C labels show each octave — middle C is C4." + (extraSub ? `<div class="handline">${extraSub}</div>` : ""),
    targets: chosen.map(m => ({ m, label: nameOf(m) })),
  };
}

// Keys a hand would normally reach: right hand from about G3 up, left hand up to about G4.
function handKeys(ks, hand) {
  const r = ks.filter(m => (hand === "R" ? m >= MIDDLE_C - 5 : m <= MIDDLE_C + 7));
  return r.length ? r : ks;
}

function handTask(ctx, hand) {
  const L = pick(ctx.es, LETTERS, ctx.prev);
  const opts = handKeys(keysOfLetter(L, ctx.lo, ctx.hi), hand);
  const m = opts[rnd(opts.length)], f = 1 + rnd(5);
  return {
    item: L,
    prompt: `Play <b>${nameOf(m)}</b>`,
    sub: `<div class="handline">${handTxt(hand, f)}</div>`,
    targets: [{ m, label: nameOf(m) }],
  };
}

function mixTask(ctx) {
  const letters = shuffle(LETTERS).slice(0, 3);
  let hand = Math.random() < 0.5 ? "L" : "R";
  const targets = letters.map(L => {
    const opts = handKeys(keysOfLetter(L, ctx.lo, ctx.hi), hand);
    const m = opts[rnd(opts.length)], f = 1 + rnd(5);
    const t = { m, item: L, label: `${nameOf(m)} · ${handShort(hand, f)}` };
    hand = hand === "L" ? "R" : "L";
    return t;
  });
  return { item: letters.join(""), ordered: true, prompt: "Play in order:", sub: "Hands alternate.", targets };
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
               ${namesTable()}
               <p class="muted">The English letters start from A = Ла. That's why C is До.</p>`,
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
               <p class="muted">Exercises write it short: <b>RH 2</b> = right hand, index finger; <b>LH 5</b> = left hand, pinky.</p>`,
        visual: h => { h.innerHTML = `<div class="card">${handsSvg()}</div>`; return {}; },
      },
      {
        title: "Connect your piano (optional)",
        html: `<p>You can tap the keys on screen, or play your real piano.</p>
               <p>To use your digital piano: connect its <b>USB to Host</b> port to your phone or laptop (on a phone you need an OTG adapter), open this app in <b>Chrome</b>, and press the button. The app will hear every key you press.</p>
               <button class="primary ghost" data-act="midi">🎹 Connect piano (MIDI)</button>
               <p class="muted midistatus"></p>
               <p class="muted">The app can check <i>which key</i> you played, but not which finger — that part is on your honour.</p>
               <p class="muted"><b>Piano shortcuts:</b> once connected, press 3 black keys together instead of tapping buttons — the low F♯ G♯ A♯ group for “Next”, the low C♯ D♯ pair for “Another round”, the top F♯ G♯ A♯ group for “Back”. Each button shows its chord.</p>`,
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
      { id: "1.1", title: "Find them all", desc: "Play 3 different keys with the same letter.", tasks: 8,
        make: ctx => { const L = pick(ctx.es, LETTERS, ctx.prev); const n = Math.min(3, keysOfLetter(L, ctx.lo, ctx.hi).length);
          return { item: L, any: { letter: L, count: n }, prompt: `Play <b>${n} different ${L}</b> keys`, sub: "Any order, any finger." }; },
        itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.2", title: "Octave names", desc: "Play F3, F5… — the C labels guide you.", tasks: 8,
        make: ctx => namesTask(ctx, 3), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.3", title: "Index finger only", desc: "Same, always with RH 2.", tasks: 8,
        make: ctx => namesTask(ctx, 2, handTxt("R", 2)), itemKeys: () => LETTERS, label: letterLabel },
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
          return { item: k, prompt: `Play <b>${k}</b>`, sub: `<div class="handline">${handTxt(hand, f)}</div>`, targets: [{ m, label: k }] };
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
        html: `<p>The sign at the start is a <b>clef</b>. It tells you which note is which. This one is the <b>treble clef</b>, also called the <b>G clef</b> (ключ сол).</p>
               <p>Its curl wraps around <b>line 2</b>, and that line is <b>G4</b> — the G just above middle C. Everything else is counted from there.</p>
               <p class="muted">The treble clef is used for higher notes, which you usually play with the right hand.</p>`,
        visual: h => staffVisual(h, ["G4"]),
      },
      {
        title: "Line notes: E G B D F",
        html: `<p>The 5 lines, bottom to top, are <b>E G B D F</b> (Ми Сол Си Ре Фа).</p>
               <p>Remember it as <i>"<b>E</b>very <b>G</b>ood <b>B</b>oy <b>D</b>oes <b>F</b>ine"</i>.</p>`,
        visual: h => staffVisual(h, ["E4", "G4", "B4", "D5", "F5"]),
      },
      {
        title: "Space notes: F A C E",
        html: `<p>The 4 spaces, bottom to top, spell <b>F A C E</b> (Фа Ла До Ми) — like the word <i>"face"</i>.</p>`,
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
      { id: "2.1", type: "notes", title: "Line notes", desc: "E G B D F only.", pass: { maxMs: 1500 }, keys: ["E4", "G4", "B4", "D5", "F5"] },
      { id: "2.2", type: "notes", title: "Space notes", desc: "F A C E only.", pass: { maxMs: 1500 }, keys: ["F4", "A4", "C5", "E5"] },
      { id: "2.3", type: "notes", title: "The whole staff", desc: "E4 to F5, lines and spaces.", keys: TREBLE.filter(n => n.step >= 0 && n.step <= 8).map(n => n.key) },
      { id: "2.4", type: "notes", title: "With ledger lines", desc: "Full range B3 to B5.", keys: TREBLE.map(n => n.key) },
      { id: "2.5", type: "notes", title: "60-second challenge", desc: "How many can you name in a minute? Pass: 25.", keys: TREBLE.map(n => n.key), timed: true },
    ],
  },
  {
    id: "3",
    title: "Notes on the keyboard",
    blurb: "See a note on the staff, play it with the right hand — then in time, then two at once.",
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
      {
        title: "Right-hand position",
        html: `<p>Put your <b>right thumb (1) on middle C</b>. Fingers 2, 3, 4, 5 rest on D, E, F, G. This is the <b>C position</b> — one finger per key.</p>
               <p>Move the whole hand up so the thumb sits on G4 and you're in the <b>G position</b> (G A B C D).</p>
               <p class="muted">In sheet music, small numbers above the notes tell you which finger to use.</p>`,
        visual: h => staffAndKb(h, { elems: ["C4", "D4", "E4", "F4", "G4"].map((k, i) => ({ keys: [k], finger: i + 1 })), mark: [60, 62, 64, 65, 67] }),
      },
      {
        title: "Keeping the beat: 4/4",
        html: `<p>Music is split into <b>bars</b> (measures). <b>4/4</b> at the start means <b>4 beats in every bar</b>.</p>
               <p>A filled note with a stem is a <b>quarter note</b>: it lasts one beat. A metronome clicks the beats — you'll hear <b>4 clicks to count in</b> ("1, 2, 3, 4"), then play one note on each click.</p>
               <button class="primary ghost" data-act="hear">▶ Hear it</button>`,
        visual: (h, root) => {
          const elems = ["C4", "D4", "E4", "F4"].map(k => ({ keys: [k] }));
          const { groups, cleanup } = staffAndKb(h, { elems, timeSig: true, mark: [] });
          let raf = null;
          root.querySelector('[data-act="hear"]').onclick = () => {
            audio();
            const { t0Perf, beatMs } = schedule(8, 60);
            const tick = () => {
              const b = Math.floor((performance.now() - t0Perf) / beatMs) - 4;
              groups.forEach((g, i) => colorChord(g, i === b ? "#3d5a80" : "#1d1b18"));
              if (b < 4) raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
          };
          return { cleanup: () => { cancelAnimationFrame(raf); cleanup(); } };
        },
      },
      {
        title: "Two notes at once",
        html: `<p>When two notes are stacked on <b>one stem</b>, play them <b>together</b>, at the same moment.</p>
               <p>Use two fingers of the right hand — for example <b>C4 + E4</b> with fingers <b>1 and 3</b>, or <b>C4 + G4</b> with <b>1 and 5</b>.</p>`,
        visual: h => staffAndKb(h, { elems: [{ keys: ["C4", "E4"] }, { keys: ["D4", "F4"] }, { keys: ["C4", "G4"] }], mark: [60, 64] }),
      },
    ],
    levels: [
      { id: "3.1", type: "staff", title: "See it, play it", desc: "One note, any right-hand finger.", tasks: 12,
        make: ctx => { const k = pick(ctx.es, KEYS, ctx.prev); return { elems: [{ keys: [k], item: k }], sub: "Right hand, any finger." }; },
        itemKeys: () => KEYS },
      { id: "3.2", type: "staff", title: "With fingering", desc: "One note, the finger number is written above it.", tasks: 12,
        make: ctx => { const k = pick(ctx.es, KEYS, ctx.prev), f = 1 + rnd(5);
          return { elems: [{ keys: [k], item: k, finger: f }], sub: `<span class="handline">${handTxt("R", f)}</span>` }; },
        itemKeys: () => KEYS },
      { id: "3.3", type: "staff", title: "Five-finger positions", desc: "4 notes in C or G position, fingers written above.", tasks: 6,
        make: ctx => positionTask(ctx, ["C4", "G4"]), itemKeys: () => KEYS },
      { id: "3.4", type: "staff", title: "Read ahead", desc: "4 notes anywhere from B3 to B5, play them in order.", tasks: 6,
        make: ctx => {
          const elems = []; let prev = ctx.prev;
          for (let i = 0; i < 4; i++) { const k = pick(ctx.es, KEYS, prev); elems.push({ keys: [k], item: k }); prev = k; }
          return { elems, sub: "Left to right, right hand. No rush — accuracy first." };
        }, itemKeys: () => KEYS },
      { id: "3.5", type: "staff", tempo: true, title: "In time (4/4)", desc: "4 notes, one per metronome click.", tasks: 6,
        make: ctx => positionTask(ctx, ["C4", "D4", "E4", "F4", "G4", "A4"]), itemKeys: () => KEYS },
      { id: "3.6", type: "staff", title: "Double notes", desc: "Two notes together, one chord at a time.", tasks: 10, pass: { maxMs: 3500 },
        make: ctx => { const k = pick(ctx.es, DYADS, ctx.prev); return { elems: [{ keys: k.split("+"), item: k }], sub: "Both notes together, right hand." }; },
        itemKeys: () => DYADS },
      { id: "3.7", type: "staff", tempo: true, title: "Double notes in time", desc: "4 double notes in 4/4.", tasks: 6, pass: { maxMs: 200 },
        make: ctx => {
          const elems = []; let prev = ctx.prev;
          for (let i = 0; i < 4; i++) { const k = pick(ctx.es, DYADS, prev); elems.push({ keys: k.split("+"), item: k }); prev = k; }
          return { elems, sub: "Two notes together on every click." };
        }, itemKeys: () => DYADS },
    ],
  },
];

// ---------- Lesson 3 helpers ----------
const KEYS = TREBLE.map(n => n.key);
const DYADS = [];
TREBLE.forEach((n, i) => [2, 3, 4].forEach(d => { if (TREBLE[i + d]) DYADS.push(n.key + "+" + TREBLE[i + d].key); }));

function positionTask(ctx, starts) {
  const start = starts[rnd(starts.length)];
  const i0 = KEYS.indexOf(start);
  const pos = KEYS.slice(i0, i0 + 5);
  const elems = []; let prev = ctx.prev;
  for (let i = 0; i < 4; i++) {
    const k = pick(ctx.es, pos, prev);
    elems.push({ keys: [k], item: k, finger: pos.indexOf(k) + 1 });
    prev = k;
  }
  return { elems, sub: `Thumb on <b>${start}</b> · fingers 1–5 on ${pos.join(" ")}` };
}

function staffAndKb(h, { notes = null, elems = null, timeSig = false, mark = [], interactive = false }) {
  const card = document.createElement("div");
  card.className = "card staff";
  h.appendChild(card);
  let groups = [];
  const drawElems = list => {
    card.innerHTML = "";
    const svg = svgEl("0 0 300 180");
    card.appendChild(svg);
    groups = drawMeasure(svg, list.map(e => ({ steps: e.keys.map(k => TREBLE.find(t => t.key === k).step), finger: e.finger })), { timeSig });
  };
  drawElems(elems || notes.map(k => ({ keys: [k] })));
  const v = kbVisual(h, { lo: 57, hi: 84, labels: interactive ? "none" : "c", info: true,
    mark: kb => { mark.forEach(m => kb.set(m, "target")); } });
  let off = () => {};
  if (interactive) {
    off = onNote(m => {
      const k = nameOf(m);
      if (TREBLE.some(t => t.key === k)) drawElems([{ keys: [k] }]);
    });
  }
  return { groups, cleanup: () => { off(); v.cleanup(); } };
}
