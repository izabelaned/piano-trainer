// Lesson 3: see notes on the staff, play them on the keyboard.
// Modes: untimed (single notes, sequences, double notes) and tempo (4/4 with metronome).
import { store, save, exState } from "./store.js";
import { SIZES, nameOf, letterOf, SOLF, midiOf, TREBLE_BY_KEY } from "./music.js";
import { Keyboard } from "./keyboard.js";
import { onNote, onMidiStatus, midiStatusText } from "./input.js";
import { svgEl, drawMeasure, colorChord } from "./staff.js";
import { finishRound, topHard } from "./engine.js";
import { renderResults } from "./results.js";
import { schedule, audio } from "./metronome.js";

const LABEL_CYCLE = ["none", "c", "all"];
const LABEL_NAMES = { c: "C labels", none: "no labels", all: "all labels" };
const C = { ink: "#1d1b18", cur: "#3d5a80", ok: "#2e7d4f", bad: "#c0392b" };
const midiOfKey = k => midiOf(k[0], +k.slice(1));
export const keyLabel = k => k.split("+").map(x => (store.settings.solf ? SOLF[x[0]] + x.slice(1) : x)).join(" + ");

export function runStaffExercise(root, level, nav) {
  const es = exState(level.id);
  const [slo, shi] = SIZES[store.settings.size];
  const lo = slo, hi = shi;    // the whole keyboard, like the real one
  const tasksPerRound = level.tasks || 8;
  const tempo = !!level.tempo;
  let labels = level.labels || "none";
  let cleanup = [];
  let alive = true;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); return t; };
  const stopTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

  function startRound() {
    cleanup.forEach(f => f()); cleanup = []; stopTimers();
    const focus = topHard(es, 3, level.itemKeys());
    const round = { i: 0, log: [], prev: null, focus, devs: [], missed: 0 };
    root.innerHTML = `
      <div class="progress"><span class="ptxt"></span><div class="bar"><div></div></div></div>
      ${tempo ? `<div class="tempobar"><span class="muted">Tempo</span><div class="seg bpm"></div></div>` : ""}
      <div class="card staff"></div>
      <div class="sub center"></div>
      <div class="feedback">&nbsp;</div>
      ${tempo ? `<button class="primary startbtn">▶ Start</button>` : ""}
      <div class="midiline muted"></div>
      <div class="kbdock"><div class="kbtools"><button class="mini" data-act="labels"></button><span class="pressed muted"></span></div><div class="kbhost"></div></div>`;
    const q = s => root.querySelector(s);
    const kb = new Keyboard(q(".kbhost"), { lo, hi, labels });
    cleanup.push(() => kb.destroy());
    const labBtn = q('[data-act="labels"]');
    const setLabBtn = () => labBtn.textContent = "🏷 " + LABEL_NAMES[labels];
    setLabBtn();
    labBtn.onclick = () => { labels = LABEL_CYCLE[(LABEL_CYCLE.indexOf(labels) + 1) % 3]; kb.setLabels(labels); setLabBtn(); };
    const showMidi = () => q(".midiline").textContent = midiStatusText();
    showMidi();
    cleanup.push(onMidiStatus(showMidi));
    const fb = (cls, txt) => { const f = q(".feedback"); f.className = "feedback " + cls; f.innerHTML = txt; };

    if (tempo) {
      const seg = q(".bpm");
      [50, 60, 72, 90].forEach(b => {
        const btn = document.createElement("button"); btn.textContent = b;
        btn.className = (store.settings.bpm || 60) === b ? "on" : "";
        btn.onclick = () => { store.settings.bpm = b; save(); seg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === btn)); };
        seg.appendChild(btn);
      });
    }

    let task, groups, idx, tLast, curErrs, curSaid, locked, beatState = null;

    function draw() {
      const svg = svgEl("0 0 300 180");
      const card = q(".card.staff"); card.innerHTML = ""; card.appendChild(svg);
      groups = drawMeasure(svg, task.elems.map(e => ({ steps: e.keys.map(k => TREBLE_BY_KEY[k].step), finger: e.finger })), { timeSig: tempo });
    }

    function nextTask() {
      kb.clearAll();
      task = level.make({ es, prev: round.prev });
      round.prev = task.elems[0].item;
      task.elems.forEach(e => { e.midis = e.keys.map(midiOfKey); e.hit = new Set(); e.done = false; e.errs = 0; e.said = []; });
      idx = 0; curErrs = 0; curSaid = []; locked = false;
      q(".ptxt").textContent = (round.i + 1) + " / " + tasksPerRound;
      q(".bar > div").style.width = (round.i / tasksPerRound * 100) + "%";
      q(".sub").innerHTML = task.sub || "";
      draw();
      if (!tempo) { colorChord(groups[0], task.elems.length > 1 ? C.cur : C.ink); fb("", "&nbsp;"); tLast = performance.now(); }
      else { locked = true; fb("", round.i === 0 ? "Press Start, listen to 4 clicks, then play one note per click." : "&nbsp;"); }
      kb.scrollTo(task.elems[0].midis[0]);
    }

    // ---------- untimed ----------
    function pressUntimed(m) {
      const cur = task.elems[idx];
      const now = performance.now();
      if (cur.midis.includes(m)) {
        if (cur.hit.size && now - cur.firstHit > 700) cur.hit = new Set();
        if (!cur.hit.size) cur.firstHit = now;
        cur.hit.add(m); kb.flash(m, "ok");
        if (cur.hit.size < cur.midis.length) { fb("", "…and the other note together"); return; }
        // element done
        round.log.push({ item: cur.item, ms: now - tLast, errs: curErrs, said: curSaid });
        colorChord(groups[idx], curErrs ? C.bad : C.ok);
        cur.midis.forEach(x => kb.set(x, null));
        idx++; tLast = now; curErrs = 0; curSaid = [];
        if (idx >= task.elems.length) {
          locked = true; fb("ok", "✓ " + task.elems.map(e => keyLabel(e.item)).join(" · "));
          round.i++;
          later(() => (round.i < tasksPerRound ? nextTask() : endRound()), 800);
        } else { colorChord(groups[idx], C.cur); fb("ok", "✓ " + keyLabel(cur.item)); kb.scrollTo(task.elems[idx].midis[0]); }
      } else {
        curErrs++; curSaid.push(nameOf(m)); kb.flash(m, "bad");
        fb("bad", "✗ That was " + nameOf(m));
        if (curErrs === 3) { cur.midis.forEach(x => kb.set(x, "hint")); kb.scrollTo(cur.midis[0]); fb("bad", "✗ That was " + nameOf(m) + " — the right key is highlighted"); }
      }
    }

    // ---------- tempo ----------
    function startMeasure() {
      audio();       // unlock audio inside the click
      const btn = q(".startbtn"); if (btn) btn.style.visibility = "hidden";
      const bpm = store.settings.bpm || 60;
      const { t0Perf, beatMs } = schedule(8, bpm);
      const exp = task.elems.map((_, j) => t0Perf + (4 + j) * beatMs);
      beatState = { t0Perf, beatMs, exp };
      locked = false;
      let lastBeat = -1;
      const tick = () => {
        if (!alive || !beatState) return;
        const now = performance.now();
        const b = Math.floor((now - t0Perf) / beatMs);
        if (b !== lastBeat) {
          lastBeat = b;
          if (b >= 0 && b < 4) fb("count", ["1", "2", "3", "4"].map((n, i) => `<span class="${i === b ? "on" : ""}">${n}</span>`).join(" "));
          if (b === 4) fb("", "Play!");
          const j = b - 4;
          task.elems.forEach((e, i) => { if (!e.done && !e.failed) colorChord(groups[i], i === j ? C.cur : C.ink); });
        }
        if (b < 9) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      later(evaluateMeasure, exp[exp.length - 1] + beatMs * 0.6 - performance.now());
    }

    function pressTempo(m) {
      if (!beatState) return;
      const { exp, beatMs } = beatState;
      const now = performance.now();
      const j = Math.round((now - exp[0]) / beatMs);
      if (j < 0 || j >= exp.length || Math.abs(now - exp[j]) > beatMs / 2) {
        if (now < exp[0] - beatMs / 2) fb("", "Wait for the 4 clicks first");
        return;
      }
      const e = task.elems[j];
      if (e.done) return;
      if (e.midis.includes(m)) {
        if (!e.hit.size) e.firstHit = now;
        e.hit.add(m); kb.flash(m, "ok");
        if (e.hit.size === e.midis.length) { e.done = true; e.dev = e.firstHit - exp[j]; colorChord(groups[j], e.errs ? C.bad : C.ok); }
      } else {
        e.errs++; e.said.push(nameOf(m)); kb.flash(m, "bad"); colorChord(groups[j], C.bad);
      }
    }

    function evaluateMeasure() {
      locked = true;
      const st = beatState; beatState = null;
      let lateSum = 0, n = 0;
      task.elems.forEach((e, i) => {
        if (!e.done) { e.errs = Math.max(1, e.errs); if (!e.said.length) { e.said.push("nothing"); round.missed++; } colorChord(groups[i], C.bad); }
        else { round.devs.push(e.dev); lateSum += e.dev; n++; }
        round.log.push({ item: e.item, ms: e.done ? Math.abs(e.dev) : null, errs: e.errs, said: e.said });
      });
      const clean = task.elems.filter(e => e.done && !e.errs).length;
      const avg = n ? lateSum / n : 0;
      const timing = n ? (Math.abs(avg) < st.beatMs * 0.08 ? "right on the beat" : `${Math.round(Math.abs(avg))} ms ${avg > 0 ? "late" : "early"} on average`) : "";
      fb(clean === task.elems.length ? "ok" : "bad", `${clean}/${task.elems.length} on the beat${timing ? " · " + timing : ""}`);
      round.i++;
      later(() => {
        if (round.i >= tasksPerRound) return endRound();
        nextTask(); startMeasure();
      }, 1800);
    }

    function press(m) {
      q(".pressed").textContent = nameOf(m) + (letterOf(m) ? " · " + SOLF[letterOf(m)] : "");
      if (tempo) pressTempo(m);
      else if (!locked) pressUntimed(m);
    }

    function endRound() {
      cleanup.forEach(f => f()); cleanup = []; stopTimers(); beatState = null;
      const res = finishRound(es, round.log, { focus: round.focus });
      save();
      const extra = () => {
        if (!tempo) return [];
        const out = [];
        if (round.devs.length) {
          const avg = round.devs.reduce((a, b) => a + b, 0) / round.devs.length;
          out.push(Math.abs(avg) < 40 ? "Your timing is right on the beat on average 👌"
            : `On average you play <b>${Math.round(Math.abs(avg))} ms ${avg > 0 ? "late" : "early"}</b>. ${avg > 0 ? "Try to find the next key while the previous click is still sounding." : "Wait for the click — don't rush."}`);
        }
        if (round.missed) out.push(`Missed beats (nothing played): <b>${round.missed}</b>. If that's a lot, lower the tempo.`);
        return out;
      };
      renderResults(root, { es, res, label: keyLabel, itemKeys: level.itemKeys(), extraInsights: extra,
        timeLabel: tempo ? "avg off-beat" : null, onNext: startRound, onHome: nav.home });
    }

    cleanup.push(onNote(press));
    nextTask();
    if (tempo) q(".startbtn").onclick = startMeasure;
  }

  startRound();
  return () => { alive = false; stopTimers(); cleanup.forEach(f => f()); };
}
