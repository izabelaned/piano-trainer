// Lesson 2 exercise: see a note on the treble staff, name it.
import { store, save, exState } from "./store.js";
import { LETTERS, TREBLE_BY_KEY } from "./music.js";
import { drawStaff, drawNote, svgEl } from "./staff.js";
import { pick, topHard, finishRound } from "./engine.js";
import { renderResults, sec } from "./results.js";
import { startGate } from "./countdown.js";

const lab = L => L;
const nm = key => lab(key[0]) + key.slice(1);

export function runNotesExercise(root, level, nav) {
  const es = exState(level.id);
  let timer = null, alive = true;

  let roundCleanup = () => {};
  let roundId = 0, first = true;
  function startRound() {
    clearInterval(timer); roundCleanup();
    const myRound = ++roundId;
    const size = store.settings.roundSize;
    const round = { i: 0, log: [], prev: null, focus: topHard(es, 3, level.keys), endAt: level.timed ? Date.now() + 60000 : null };
    root.innerHTML = `
      <div class="progress"><button class="mini backmini" title="Back to lessons">←</button><span class="ptxt"></span><div class="bar"><div></div></div><button class="mini restart" data-shortcut="restart" title="Start this round again">↺ Restart</button></div>
      <div class="card staff"></div>
      <div class="feedback">&nbsp;</div>
      <div class="namedock"><div class="keys"></div><div class="kbtip">⌨️ You can also type C D E F G A B</div></div>`;
    const q = s => root.querySelector(s);
    const svg = svgEl("0 22 300 148");
    q(".card.staff").appendChild(svg);
    const keysDiv = q(".keys");
    LETTERS.forEach(L => {
      const b = document.createElement("button");
      b.textContent = lab(L); b.dataset.l = L;
      b.onclick = () => answer(L, b);
      keysDiv.appendChild(b);
    });

    // Computer keyboard: press C D E F G A B instead of tapping.
    const onKey = e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const L = e.key.toUpperCase();
      if (!LETTERS.includes(L)) return;
      const btn = keysDiv.querySelector(`[data-l="${L}"]`);
      if (btn) { e.preventDefault(); answer(L, btn); }
    };
    document.addEventListener("keydown", onKey);
    roundCleanup = () => document.removeEventListener("keydown", onKey);

    let cur, t0, locked = true, noteG = null;
    function draw(color) {
      if (noteG) noteG.remove();
      noteG = drawNote(svg, TREBLE_BY_KEY[cur].step, 190, { color });
    }
    function show() {
      locked = false;
      keysDiv.querySelectorAll("button").forEach(b => b.className = "");
      q(".feedback").className = "feedback"; q(".feedback").innerHTML = "&nbsp;";
      if (!level.timed) {
        q(".ptxt").textContent = (round.i + 1) + " / " + size;
        q(".bar > div").style.width = (round.i / size * 100) + "%";
      }
      cur = pick(es, level.keys, round.prev); round.prev = cur;
      svg.innerHTML = ""; noteG = null; drawStaff(svg); draw();
      t0 = performance.now();
    }
    function answer(L, btn) {
      if (locked || !alive) return;
      locked = true;
      const ms = performance.now() - t0, ok = L === cur[0];
      round.log.push({ item: cur, ms: ok ? ms : null, errs: ok ? 0 : 1, said: ok ? [] : [lab(L)] });
      const shown = lab(cur[0]) + (store.settings.showOct ? cur.slice(1) : "");
      if (ok) { btn.className = "right"; q(".feedback").className = "feedback ok"; q(".feedback").textContent = "✓ " + shown; draw("#2e7d4f"); }
      else {
        btn.className = "wrong"; keysDiv.querySelector(`[data-l="${cur[0]}"]`).className = "right";
        q(".feedback").className = "feedback bad"; q(".feedback").textContent = "✗ It was " + shown; draw("#c0392b");
      }
      round.i++;
      setTimeout(() => {
        if (!alive || myRound !== roundId) return;
        if (level.timed ? Date.now() < round.endAt : round.i < size) show(); else end();
      }, ok ? 450 : 1400);
    }
    function end() {
      clearInterval(timer); roundCleanup();
      const score = level.timed ? round.log.filter(r => r.errs === 0).length : null;
      const res = finishRound(es, round.log, { focus: round.focus, score, criteria: nav.criteria });
      save();
      renderResults(root, { es, res, label: nm, itemKeys: level.keys, extraInsights: notesInsights,
        unitWord: "correct", onNext: startRound, onHome: nav.home, nav, nextTitle: level.timed ? "Try again" : "Another round" });
    }
    const startTimer = () => {
      if (!level.timed) return;
      round.endAt = Date.now() + 60000;
      const tick = () => {
        const left = Math.max(0, round.endAt - Date.now());
        q(".ptxt").textContent = "⏱ " + Math.ceil(left / 1000) + "s · " + round.log.filter(r => !r.errs).length + " correct";
        q(".bar > div").style.width = ((60000 - left) / 600) + "%";
        if (left <= 0 && !locked) { locked = true; end(); }
      };
      timer = setInterval(tick, 250); tick();
    };
    q(".backmini").onclick = nav.home;
    q(".restart").onclick = startRound;
    if (level.timed) { q(".ptxt").textContent = "⏱ 60s"; }
    startGate(root, { needStart: first }).then(() => { if (myRound !== roundId || !alive) return; startTimer(); show(); });
    first = false;
  }

  startRound();
  return () => { alive = false; clearInterval(timer); roundCleanup(); };
}

function notesInsights(per) {
  const out = [];
  const timed = Object.keys(per).filter(k => per[k].avg != null);
  const zone = k => { const s = TREBLE_BY_KEY[k].step; return s < 0 ? "below the staff" : s > 8 ? "above the staff" : "on the staff"; };
  const z = {};
  timed.forEach(k => (z[zone(k)] = z[zone(k)] || []).push(per[k].avg));
  const za = Object.entries(z).map(([n, v]) => [n, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => b[1] - a[1]);
  if (za.length >= 2 && za[0][1] > za[za.length - 1][1] * 1.25)
    out.push(`Notes ${za[0][0]} are your slowest zone (${sec(za[0][1])} vs ${sec(za[za.length - 1][1])} ${za[za.length - 1][0]}).`);
  const ls = { line: [], space: [] };
  timed.forEach(k => { const s = TREBLE_BY_KEY[k].step; if (s >= 0 && s <= 8) ls[s % 2 === 0 ? "line" : "space"].push(per[k].avg); });
  if (ls.line.length && ls.space.length) {
    const al = ls.line.reduce((a, b) => a + b, 0) / ls.line.length, as = ls.space.reduce((a, b) => a + b, 0) / ls.space.length;
    if (Math.max(al, as) > Math.min(al, as) * 1.2)
      out.push(`${al > as ? "Line notes (E G B D F)" : "Space notes (F A C E)"} are slower for you (${sec(Math.max(al, as))} vs ${sec(Math.min(al, as))}).`);
  }
  return out;
}
