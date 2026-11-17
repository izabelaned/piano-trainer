// "Start" button, then 3 · 2 · 1 · Go! — so the first task doesn't catch you unprepared.
// The overlay lives inside `host`, so leaving the screen removes it automatically.
export function startGate(host, { needStart = true } = {}) {
  return new Promise(resolve => {
    const ov = document.createElement("div");
    ov.className = "gate";
    host.appendChild(ov);
    const count = () => {
      const steps = ["3", "2", "1", "Go!"];
      let i = 0;
      const tick = () => {
        if (!ov.isConnected) return;
        if (i === steps.length) { ov.remove(); resolve(); return; }
        ov.innerHTML = `<div class="gatenum ${i === 3 ? "go" : ""}">${steps[i]}</div>`;
        i++;
        setTimeout(tick, i === 4 ? 450 : 750);
      };
      tick();
    };
    if (needStart) {
      ov.innerHTML = `<button class="primary gatestart" data-shortcut="primary">▶ Start</button>
        <div class="muted gatehint">Get your hand ready on the keyboard</div>`;
      ov.querySelector(".gatestart").onclick = count;
    } else count();
  });
}
