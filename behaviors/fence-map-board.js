// The map board near the lookout: a map of what might be past the fence.
// Clicking it opens the big map (click anywhere to close it). Everything is drawn right here in the browser.
export default function setup({ say }) {
  let box = null;
  const places = [
    { x: 0.5, y: 0.82, t: "My yard", c: "#5a8f3a" },
    { x: 0.2, y: 0.55, t: "Whispering Woods", c: "#2d5a33" },
    { x: 0.42, y: 0.34, t: "The Long River", c: "#2f6fb0" },
    { x: 0.8, y: 0.62, t: "Glass Lake", c: "#2f6fb0" },
    { x: 0.74, y: 0.12, t: "The Tall Hills", c: "#6b5a4a" },
    { x: 0.58, y: 0.22, t: "X marks... something?", c: "#b0281a" },
    { x: 0.5, y: 0.03, t: "??? (too foggy to tell)", c: "#777" }
  ];
  function draw(cv) {
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    g.fillStyle = "#efdcae"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#4d3420"; g.lineWidth = 4; g.strokeRect(10, 10, W - 20, H - 20);
    // fog at the top
    for (let i = 0; i < 26; i++) { g.fillStyle = "rgba(225,225,230,.6)"; g.beginPath(); g.arc(Math.random() * W, Math.random() * 40, 30 + Math.random() * 25, 0, 7); g.fill(); }
    // hills
    for (const [x, w, h] of [[0.6, 0.18, 0.16], [0.74, 0.22, 0.22], [0.88, 0.16, 0.14], [0.47, 0.14, 0.11]]) {
      g.fillStyle = "#8a7766"; g.beginPath(); g.moveTo((x - w / 2) * W, 0.2 * H); g.lineTo(x * W, (0.2 - h) * H); g.lineTo((x + w / 2) * W, 0.2 * H); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.moveTo((x - w / 6) * W, (0.2 - h * 0.66) * H); g.lineTo(x * W, (0.2 - h) * H); g.lineTo((x + w / 6) * W, (0.2 - h * 0.66) * H); g.fill();
    }
    // river
    g.strokeStyle = "#5f9fd6"; g.lineWidth = 12; g.lineCap = "round"; g.beginPath();
    [[0, 0.18], [0.18, 0.26], [0.33, 0.22], [0.49, 0.36], [0.65, 0.41], [0.82, 0.37], [1, 0.45]].forEach(([x, y], i) => i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)); g.stroke();
    // lake
    g.fillStyle = "#6aa8dd"; g.beginPath(); g.ellipse(0.8 * W, 0.66 * H, 0.11 * W, 0.08 * H, 0.3, 0, 7); g.fill();
    // woods
    for (let i = 0; i < 45; i++) { const x = 0.05 + Math.random() * 0.28, y = 0.36 + Math.random() * 0.38; g.fillStyle = i % 3 ? "#2f6b36" : "#3f8546"; g.beginPath(); g.arc(x * W, y * H, 10 + Math.random() * 7, 0, 7); g.fill(); }
    // yard
    g.fillStyle = "#8cc96b"; g.fillRect(0.38 * W, 0.73 * H, 0.24 * W, 0.2 * H);
    g.strokeStyle = "#7a4a22"; g.lineWidth = 4; g.setLineDash([10, 5]); g.strokeRect(0.38 * W, 0.73 * H, 0.24 * W, 0.2 * H);
    // dotted path to the X
    g.strokeStyle = "#4d3420"; g.lineWidth = 3; g.setLineDash([6, 8]); g.beginPath();
    g.moveTo(0.5 * W, 0.73 * H); g.bezierCurveTo(0.46 * W, 0.6 * H, 0.62 * W, 0.5 * H, 0.58 * W, 0.24 * H); g.stroke(); g.setLineDash([]);
    g.strokeStyle = "#b0281a"; g.lineWidth = 5; g.beginPath(); g.moveTo(0.56 * W, 0.2 * H); g.lineTo(0.6 * W, 0.26 * H); g.moveTo(0.6 * W, 0.2 * H); g.lineTo(0.56 * W, 0.26 * H); g.stroke();
    // labels
    g.font = "800 17px Nunito, sans-serif"; g.textAlign = "center";
    for (const p of places) { g.fillStyle = "rgba(255,250,235,.85)"; const w = g.measureText(p.t).width + 12; g.fillRect(p.x * W - w / 2, p.y * H + 14, w, 22); g.fillStyle = p.c; g.fillText(p.t, p.x * W, p.y * H + 31); }
    g.fillStyle = "#4d3420"; g.font = "800 22px Nunito, sans-serif"; g.fillText("What's past my fence (I think)", W / 2, H - 22);
  }
  function open() {
    box = document.createElement("div");
    Object.assign(box.style, { position: "fixed", inset: "0", background: "rgba(30,25,40,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, cursor: "pointer" });
    const cv = document.createElement("canvas"); cv.width = 640; cv.height = 640;
    Object.assign(cv.style, { width: "min(88vw, 88vh)", height: "min(88vw, 88vh)", borderRadius: "14px", border: "3px solid #2b2540", boxShadow: "0 10px 40px rgba(0,0,0,.35)" });
    draw(cv); box.appendChild(cv);
    box.addEventListener("click", close); document.body.appendChild(box);
  }
  function close() { box?.remove(); box = null; }
  return {
    onClick() {
      if (box) return close();
      say("This is my best guess at what's past the fence. Someday I'll go see the X!", 4);
      open();
    }
  };
}
