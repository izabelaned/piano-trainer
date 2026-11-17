// Lesson 1 / 3 style exercise: a task asks for keys, you play them (screen or MIDI).
import { store, save, exState } from "./store.js";
import { SIZES, letterOf, nameOf, MIDDLE_C } from "./music.js";
import { Keyboard } from "./keyboard.js";
import { onNote, onMidiStatus, midiStatusText } from "./input.js";
import { finishRound, topHard } from "./engine.js";
import { renderResults } from "./results.js";
import { handsSvg, handWords } from "./hands.js";
import { startGate } from "./countdown.js";

const LABEL_CYCLE = ["c", "none", "all"];
const LABEL_NAMES = { c: "C labels", none: "no labels", all: "all labels" };

export function runKeysExercise(root, level, nav) {
  const es = exState(level.id);
  const [lo, hi] = SIZES[store.settings.size];
  const tasksPerRound = level.tasks || 8;
  let labels = level.labels || "c";
  let cleanup = [];

  let roundId = 0, first = true;
  function startRound() {
    cleanup.forEach(f => f()); cleanup = [];
    const myRound = ++roundId;
    const focus = topHard(es, 3, level.itemKeys ? level.itemKeys(lo, hi) : null);
    const round = { i: 0, log: [], prev: null, focus };
    root.innerHTML = `
      <div class="progress"><button class="mini backmini" title="Back to lessons">←</button><span class="ptxt"></span><div class="bar"><div></div></div><button class="mini restart" data-shortcut="restart" title="Start this round again">↺ Restart</button></div>
      <div class="card task">
        <div class="handviz"></div>
        <div class="prompt"></div>
        <div class="sub"></div>
        <div class="chips"></div>
      </div>
      <div class="feedback">&nbsp;</div>
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

    let task, tStart, tLast, curErrs, curSaid, totalErrs, saidAll, locked = true, found;

    function chipHtml() {
      if (task.any) {
        return Array.from({ length: task.any.count }, (_, i) =>
          `<span class="chip ${i < found.size ? "done" : ""}">${i < found.size ? "✓" : "○"} ${task.any.letter}</span>`).join("");
      }
      const cur = task.ordered ? task.targets.findIndex(t => !t.done) : -1;
      return task.targets.map((t, i) => `<span class="chip ${t.done ? "done" : ""} ${i === cur ? "cur" : ""}">${t.done ? "✓" : task.ordered ? (i + 1) + "." : "○"} ${t.label}</span>`).join("");
    }

    // Which hand and finger to use right now (for sequences: the current key's).
    function showHand() {
      const box = q(".handviz");
      let h = null;
      if (task.ordered) { const t = task.targets.find(t => !t.done); if (t && t.hand) h = { hand: t.hand, finger: t.finger }; }
      else if (task.hand) h = { hand: task.hand, finger: task.finger };
      box.innerHTML = h ? `<div class="handwords">${handWords(h.hand, h.finger)}</div>${handsSvg(h)}` : "";
    }

    function nextTask() {
      kb.clearAll();
      locked = false; found = new Set(); curErrs = 0; curSaid = []; totalErrs = 0; saidAll = [];
      task = level.make({ lo, hi, es, prev: round.prev });
      round.prev = task.item;
      q(".ptxt").textContent = (round.i + 1) + " / " + tasksPerRound;
      q(".bar > div").style.width = (round.i / tasksPerRound * 100) + "%";
      q(".prompt").innerHTML = task.prompt;
      q(".sub").innerHTML = task.sub || "";
      q(".chips").innerHTML = chipHtml();
      showHand();
      q(".feedback").className = "feedback"; q(".feedback").innerHTML = "&nbsp;";
      const anchor = task.targets && task.targets.length ? task.targets.find(t => !t.done).m : MIDDLE_C;
      kb.scrollTo(anchor);
      tStart = tLast = performance.now();
    }

    function wrong(m) {
      curErrs++; totalErrs++;
      const nm = letterOf(m) ? nameOf(m) : nameOf(m);
      curSaid.push(nm); saidAll.push(nm);
      kb.flash(m, "bad");
      const fb = q(".feedback"); fb.className = "feedback bad"; fb.textContent = "✗ That was " + nm;
      // after 3 misses, show where it is
      if (totalErrs === 3) {
        if (task.any) {
          q(".sub").innerHTML += `<div class="hintline">Hint: ${task.any.letter} is ${hintFor(task.any.letter)}.</div>`;
        } else {
          const t = task.targets.find(t => !t.done);
          if (t) { kb.set(t.m, "hint"); kb.scrollTo(t.m); }
        }
      }
    }

    function complete() {
      locked = true;
      const now = performance.now();
      if (!task.ordered) {
        const n = task.any ? task.any.count : task.targets.length;
        round.log.push({ item: task.item, ms: (now - tStart) / n, errs: totalErrs, said: saidAll });
      }
      const fb = q(".feedback"); fb.className = "feedback ok"; fb.textContent = "✓ Well done";
      q(".chips").innerHTML = chipHtml();
      round.i++;
      setTimeout(() => { if (myRound !== roundId) return; if (round.i < tasksPerRound) nextTask(); else endRound(); }, 750);
    }

    function press(m) {
      if (locked) return;
      q(".pressed").textContent = nameOf(m);
      if (task.any) {
        if (letterOf(m) === task.any.letter && !found.has(m)) {
          found.add(m); kb.set(m, "ok"); q(".chips").innerHTML = chipHtml();
          q(".feedback").className = "feedback ok"; q(".feedback").textContent = "✓ " + nameOf(m);
          if (found.size >= task.any.count) complete();
        } else if (!found.has(m)) wrong(m);
        return;
      }
      if (task.ordered) {
        const t = task.targets.find(t => !t.done);
        if (t.m === m) {
          t.done = true; kb.set(m, "ok");
          const now = performance.now();
          round.log.push({ item: t.item, ms: now - tLast, errs: curErrs, said: curSaid });
          tLast = now; curErrs = 0; curSaid = [];
          q(".chips").innerHTML = chipHtml();
          showHand();
          if (task.targets.every(t => t.done)) complete();
          else { q(".feedback").className = "feedback ok"; q(".feedback").textContent = "✓ " + nameOf(m); kb.scrollTo(task.targets.find(t => !t.done).m); }
        } else if (!task.targets.some(x => x.done && x.m === m)) wrong(m);
        return;
      }
      const t = task.targets.find(t => !t.done && t.m === m);
      if (t) {
        t.done = true; kb.set(m, "ok"); q(".chips").innerHTML = chipHtml();
        if (task.targets.every(t => t.done)) complete();
        else { q(".feedback").className = "feedback ok"; q(".feedback").textContent = "✓ " + nameOf(m); }
      } else if (!task.targets.some(x => x.done && x.m === m)) wrong(m);
    }

    function endRound() {
      cleanup.forEach(f => f()); cleanup = [];
      const res = finishRound(es, round.log, { focus: round.focus, criteria: nav.criteria });
      save();
      renderResults(root, {
        es, res, label: level.label || (k => k),
        itemKeys: level.itemKeys ? level.itemKeys(lo, hi) : null,
        onNext: startRound, onHome: nav.home, nav,
      });
    }

    cleanup.push(onNote(press));
    q(".backmini").onclick = nav.home;
    q(".restart").onclick = startRound;
    startGate(root, { needStart: first }).then(() => { if (myRound === roundId) nextTask(); });
    first = false;
  }

  startRound();
  return () => { roundId++; cleanup.forEach(f => f()); };
}

function hintFor(L) {
  return {
    C: "the white key just left of the 2 black keys",
    D: "between the 2 black keys",
    E: "just right of the 2 black keys",
    F: "just left of the 3 black keys",
    G: "between the 1st and 2nd of the 3 black keys",
    A: "between the 2nd and 3rd of the 3 black keys",
    B: "just right of the 3 black keys",
  }[L];
}
