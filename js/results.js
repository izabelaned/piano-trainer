// Results screen shared by all exercises.
import { topHard, PASS_ROUNDS } from "./engine.js";

const sec = ms => (ms / 1000).toFixed(1) + "s";

function delta(now, prev, lowerIsBetter, fmt) {
  if (prev == null || now == null) return "";
  const diff = now - prev, good = lowerIsBetter ? diff < 0 : diff > 0;
  if (Math.abs(diff) < (lowerIsBetter ? 50 : 0.5)) return ` <span class="muted">(same)</span>`;
  return ` <span class="delta ${good ? "good" : "badd"}">${diff > 0 ? "▲" : "▼"} ${fmt(Math.abs(diff))}</span>`;
}

// opts: es, res {summary, per, prevRound, prevItems}, label(item), itemKeys, extraInsights(per) -> [html],
//       onNext, onHome, nextTitle, unitWord
export function renderResults(root, opts) {
  const { es, res, label } = opts;
  const { summary: sum, per, prevRound, prevItems } = res;
  const acc = sum.n ? Math.round(sum.correct / sum.n * 100) : 0;
  const prevAcc = prevRound && prevRound.n ? Math.round(prevRound.correct / prevRound.n * 100) : null;

  let html = "";
  const checks = sum.checks || [];
  const dots = Array.from({ length: PASS_ROUNDS }, (_, i) => `<span class="${i < Math.min(es.passCount || 0, PASS_ROUNDS) ? "on" : ""}"></span>`).join("");
  html += `<div class="card verdict ${sum.pass ? "ok" : "no"}">
    <div class="vhead">${sum.pass ? "✓ Passing round" : "✗ Not a passing round yet"}</div>
    <div class="checks">${checks.map(c => `<div class="check ${c.ok ? "ok" : "no"}"><span>${c.ok ? "✓" : "✗"} ${c.name}</span><b>${c.val}</b><small>goal ${c.goal}</small></div>`).join("")}</div>
    <div class="passdots">${dots}<span>${Math.min(es.passCount || 0, PASS_ROUNDS)} / ${PASS_ROUNDS} passing rounds${es.passed ? " — <b>level passed ✓</b>" : ""}</span></div>
  </div>`;
  html += `<div class="actions"></div>`;
  html += `<div class="card"><div class="big">
      ${sum.score != null ? `<div><b>${sum.score}</b><span>correct in 60s${delta(sum.score, prevRound && prevRound.score, false, x => x)}</span></div><div><b>${es.best}</b><span>best</span></div>`
        : `<div><b>${sum.correct}/${sum.n}</b><span>${opts.unitWord || "clean"}${delta(acc, prevAcc, false, x => Math.round(x) + "%")}</span></div>`}
      <div><b>${sum.avgMs ? sec(sum.avgMs) : "–"}</b><span>${opts.timeLabel || "avg time"}${delta(sum.avgMs, prevRound && prevRound.avgMs, true, sec)}</span></div>
      <div><b>${es.rounds.length}</b><span>rounds played</span></div></div></div>`;

  // focus notes from last round
  if (sum.focus && sum.focus.length) {
    const rows = sum.focus.map(k => {
      const before = prevItems[k] && prevItems[k].ema, p = per[k];
      if (!p) return `<tr><td class="n">${label(k)}</td><td colspan="2" class="muted">didn't come up</td></tr>`;
      let v = "";
      if (p.avg != null && before != null) v = p.avg < before * 0.9 ? `<span class="delta good">improved ✓</span>`
        : p.avg > before * 1.1 ? `<span class="delta badd">slower</span>` : `<span class="muted">about the same</span>`;
      if (p.errs) v += ` <span class="delta badd">${p.errs} wrong</span>`;
      return `<tr><td class="n">${label(k)}</td><td>${before ? sec(before) : "–"} → ${p.avg ? sec(p.avg) : "–"}</td><td>${v}</td></tr>`;
    }).join("");
    html += `<h2>Your focus from last time</h2><div class="card"><table><tr><th>Item</th><th>Before → now</th><th></th></tr>${rows}</table></div>`;
  }

  // insights
  const keys = Object.keys(per).sort((a, b) => (per[b].avg ?? 1e9) - (per[a].avg ?? 1e9));
  const timed = keys.filter(k => per[k].avg != null);
  const ins = [];
  if (timed.length >= 2) {
    ins.push("Slowest: " + timed.slice(0, 3).map(k => `<b>${label(k)}</b> (${sec(per[k].avg)})`).join(", ") + ".");
    ins.push("Fastest: " + timed.slice(-2).reverse().map(k => `<b>${label(k)}</b>`).join(", ") + " — these are solid.");
  }
  const conf = [];
  Object.entries(per).forEach(([k, p]) => Object.entries(p.said).forEach(([s, c]) => conf.push({ k, s, c })));
  conf.sort((a, b) => b.c - a.c);
  if (conf.length) ins.push("Mix-ups: " + conf.slice(0, 4).map(x => `<b>${label(x.k)}</b> → you played/said ${x.s}${x.c > 1 ? " (" + x.c + "×)" : ""}`).join("; ") + ".");
  else ins.push("No mistakes this round 🎉");
  if (opts.extraInsights) ins.push(...opts.extraInsights(per));
  html += `<h2>Insights</h2><div class="card"><ul class="ins">${ins.map(x => `<li>${x}</li>`).join("")}</ul></div>`;

  // table
  const maxT = Math.max(1, ...timed.map(k => per[k].avg));
  html += `<h2>Every item (slowest first)</h2><div class="card"><table><tr><th>Item</th><th>Shown</th><th>Avg</th><th style="width:28%"></th><th>Wrong</th></tr>` +
    keys.map(k => { const p = per[k];
      return `<tr><td class="n">${label(k)}</td><td>${p.seen}×</td><td>${p.avg ? sec(p.avg) : "–"}</td>
        <td><div class="meter" style="width:${p.avg ? Math.max(4, p.avg / maxT * 100) : 0}%"></div></td>
        <td style="color:${p.errs ? "var(--bad)" : "var(--muted)"}">${p.errs}</td></tr>`; }).join("") + `</table></div>`;

  // next focus
  const next = topHard(es, 3, opts.itemKeys);
  if (next.length) html += `<h2>Next round will focus on</h2><div class="card">${next.map(k => `<span class="tag">${label(k)}</span>`).join("")}
    <div class="muted" style="margin-top:6px">These show up more often. Easy ones still appear sometimes so you don't forget them.</div></div>`;


  const hist = es.rounds.slice(-8);
  if (hist.length > 1) {
    html += `<h2>Last rounds</h2><div class="card"><table><tr><th>#</th><th>${sum.score != null ? "Score" : "Clean"}</th><th>Avg time</th></tr>` +
      hist.map((r, i) => `<tr><td>${es.rounds.length - hist.length + i + 1}</td><td>${r.score != null ? r.score : r.correct + "/" + r.n}</td><td>${r.avgMs ? sec(r.avgMs) : "–"}</td></tr>`).reverse().join("") +
      `</table></div>`;
  }
  html += `<button class="linkbtn" data-act="home">Back to lessons</button>`;

  root.innerHTML = html;
  root.querySelector('[data-act="home"]').onclick = opts.onHome;
  // actions: until the level is passed you can only keep practising
  const act = root.querySelector(".actions");
  const again = document.createElement("button");
  again.textContent = opts.nextTitle || "Another round";
  again.onclick = opts.onNext;
  const nx = opts.nav && opts.nav.next;
  if (es.passed && nx) {
    const go = document.createElement("button");
    go.className = "primary"; go.dataset.shortcut = "primary"; go.textContent = nx.label;
    go.onclick = nx.go;
    again.className = "primary ghost"; again.dataset.shortcut = "secondary";
    act.append(go, again);
  } else {
    again.className = "primary"; again.dataset.shortcut = "primary";
    act.append(again);
    if (es.passed) act.insertAdjacentHTML("beforeend", `<p class="muted center">🎉 You've finished every level!</p>`);
  }
  window.scrollTo(0, 0);
}

export { sec };
