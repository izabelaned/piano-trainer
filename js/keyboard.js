// On-screen piano keyboard. Tapping a key sends it through the input layer.
import { isWhite, letterOf, octaveOf, nameOf, MIDDLE_C } from "./music.js";
import { emitNote } from "./input.js";
import { store } from "./store.js";

export class Keyboard {
  // opts: lo, hi, labels: "none" | "c" | "all" | "allOct", fit: true/false
  constructor(container, opts) {
    this.container = container;
    this.opts = Object.assign({ labels: "c", fit: null }, opts);
    this.state = {};   // midi -> persistent class
    this.fingers = {}; // midi -> finger number shown on the key
    this.wrap = document.createElement("div");
    this.wrap.className = "kb-scroll";
    this.el = document.createElement("div");
    this.el.className = "kb";
    this.wrap.appendChild(this.el);
    container.appendChild(this.wrap);
    this.keys = {};
    this.render();
    this._onResize = () => this.render();
    window.addEventListener("resize", this._onResize);
  }

  destroy() { window.removeEventListener("resize", this._onResize); this.wrap.remove(); }

  whiteCount() { let n = 0; for (let m = this.opts.lo; m <= this.opts.hi; m++) if (isWhite(m)) n++; return n; }

  fits() {
    if (this.opts.fit != null) return this.opts.fit;
    return store.settings.zoom !== "large";   // default: the whole keyboard fits the width
  }

  render() {
    const { lo, hi } = this.opts;
    const avail = this.container.clientWidth || 360;
    const wc = this.whiteCount();
    const w = this.fits() ? avail / wc : Math.max(34, avail / wc);
    const h = Math.min(150, Math.max(90, w * 4.2));
    this.el.innerHTML = "";
    this.el.style.width = (w * wc) + "px";
    this.el.style.height = h + "px";
    this.keys = {};
    let wi = 0;
    for (let m = lo; m <= hi; m++) {
      const k = document.createElement("div");
      k.dataset.m = m;
      if (isWhite(m)) {
        k.className = "key white";
        k.style.left = (wi * w) + "px";
        k.style.width = w + "px";
        wi++;
      } else {
        k.className = "key black";
        k.style.left = (wi * w - w * 0.3) + "px";
        k.style.width = (w * 0.6) + "px";
        k.style.height = (h * 0.62) + "px";
      }
      const lab = this.labelFor(m, w);
      if (lab) { const s = document.createElement("span"); s.className = "lab"; s.innerHTML = lab; k.appendChild(s); }
      if (m === MIDDLE_C) k.classList.add("middle");
      if (this.state[m]) k.classList.add(this.state[m]);
      if (this.fingers[m]) { k.classList.add("pos"); const f = document.createElement("span"); f.className = "fnum"; f.textContent = this.fingers[m]; k.appendChild(f); }
      k.addEventListener("pointerdown", e => { e.preventDefault(); emitNote(m, "screen"); });
      this.el.appendChild(k);
      this.keys[m] = k;
    }
  }

  labelFor(m, w) {
    const L = letterOf(m);
    if (!L) return "";
    const mode = this.opts.labels;
    const letter = L;
    if (mode === "none") return m === MIDDLE_C ? "•" : "";
    if (mode === "c") return L === "C" ? (w >= 18 ? "C" + octaveOf(m) : w >= 9 ? "<small>C" + octaveOf(m) + "</small>" : "") : "";
    if (mode === "all") return w >= 16 || L === "C" ? letter : "";
    if (mode === "allOct") return w >= 22 ? letter + "<small>" + octaveOf(m) + "</small>" : (L === "C" ? "C" + octaveOf(m) : "");
    return "";
  }

  setLabels(mode) { this.opts.labels = mode; this.render(); }

  // Show where the hand sits: { midi: fingerNumber }. Pass {} to clear.
  showFingers(map) {
    this.fingers = map || {};
    Object.entries(this.keys).forEach(([m, k]) => {
      k.classList.toggle("pos", !!this.fingers[m]);
      const old = k.querySelector(".fnum"); if (old) old.remove();
      if (this.fingers[m]) { const f = document.createElement("span"); f.className = "fnum"; f.textContent = this.fingers[m]; k.appendChild(f); }
    });
  }

  // Persistent highlight (e.g. a found key). cls null clears it.
  set(m, cls) {
    if (cls) this.state[m] = cls; else delete this.state[m];
    const k = this.keys[m];
    if (k) { k.classList.remove("ok", "bad", "hint", "target"); if (cls) k.classList.add(cls); }
  }
  clearAll() { Object.keys(this.state).forEach(m => this.set(+m, null)); }

  // Short flash after a press.
  flash(m, cls, ms = 450) {
    const k = this.keys[m];
    if (!k) return;
    k.classList.add(cls);
    setTimeout(() => { if (this.state[m] !== cls) k.classList.remove(cls); }, ms);
  }

  scrollTo(m) {
    const k = this.keys[m];
    if (!k) return;
    const x = parseFloat(k.style.left) - this.wrap.clientWidth / 2;
    this.wrap.scrollLeft = Math.max(0, x);
  }
}

export { nameOf };
