// Draws a GitHub contribution graph as a CNC raster toolpath (animated SVG, dark + light).
// Usage: node toolpath.mjs [user] [outDir]
// shortcut: scrapes the public profile HTML, switch to GraphQL + token if GitHub changes the markup.
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const user = process.argv[2] ?? "SickSartori";
const outDir = process.argv[3] ?? "assets";
const CELL = 11, STEP = 14, PAD = 12, FOOT = 22, DUR = 7; // px, px, px, px, seconds

const res = await fetch(`https://github.com/users/${user}/contributions`);
assert(res.ok, `GitHub answered ${res.status}`);
const html = await res.text();

const total = html.match(/([\d,]+)\s+contributions/)?.[1];
assert(total, "total not found: markup changed?");

// Legend squares share the day class but have no data-date, so they are skipped here.
const days = [...html.matchAll(/<td\b[^>]*data-date="([\d-]+)"[^>]*>/g)]
  .map((m) => ({ date: m[1], level: Number(m[0].match(/data-level="(\d)"/)?.[1]) }))
  .sort((a, b) => (a.date < b.date ? -1 : 1));

// Fail loudly instead of committing a broken graph.
const dayNo = (d) => Date.parse(`${d}T00:00:00Z`) / 864e5;
assert(days.length >= 360 && days.length <= 372, `unexpected day count ${days.length}`);
assert(new Date(days[0].date).getUTCDay() === 0, "first day is not a Sunday");
days.forEach((d, i) => {
  assert(dayNo(d.date) - dayNo(days[0].date) === i, `gap at ${d.date}`);
  assert(d.level >= 0 && d.level <= 4, `bad level at ${d.date}`);
});

const cols = Math.ceil(days.length / 7);
const cells = days.map((d, i) => ({ ...d, col: Math.floor(i / 7), row: i % 7 }));
// Raster pocketing: down the even weeks, back up the odd ones.
const order = cells.toSorted((a, b) => a.col - b.col || (a.col % 2 ? b.row - a.row : a.row - b.row));

const cx = (c) => PAD + c.col * STEP + CELL / 2;
const cy = (c) => PAD + c.row * STEP + CELL / 2;
const dist = [0];
for (let i = 1; i < order.length; i++) {
  dist.push(dist[i - 1] + Math.hypot(cx(order[i]) - cx(order[i - 1]), cy(order[i]) - cy(order[i - 1])));
}
order.forEach((c, i) => (c.delay = (dist[i] / dist.at(-1)) * DUR)); // tool reaches the cell at this time
const path = order.map((c, i) => `${i ? "L" : "M"}${cx(c)} ${cy(c)}`).join("");

const W = PAD * 2 + (cols - 1) * STEP + CELL;
const H = PAD * 2 + 6 * STEP + CELL + FOOT;
const themes = {
  dark: { lv: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"], accent: "#f0883e", muted: "#8b949e" },
  light: { lv: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"], accent: "#d1580a", muted: "#57606a" },
};

mkdirSync(outDir, { recursive: true });
for (const [name, t] of Object.entries(themes)) {
  const rects = order.map(
    (c) =>
      `<rect class="c" x="${PAD + c.col * STEP}" y="${PAD + c.row * STEP}" width="${CELL}" height="${CELL}" rx="2" fill="${t.lv[c.level]}" style="animation-delay:${c.delay.toFixed(2)}s"/>`,
  );
  // Resting state (no CSS animation) is the finished carving, so reduced-motion viewers get that.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>${user}: ${total} contributions, as a CNC toolpath</title>
<style>
.c{animation:cut .5s ease-out both}
.p{fill:none;stroke:${t.accent};stroke-width:1.2;stroke-opacity:.5;stroke-linejoin:round;stroke-dasharray:1;animation:draw ${DUR}s linear both}
.t{fill:${t.accent}}
text{font:11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:${t.muted}}
@keyframes cut{from{opacity:.06}}
@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.c,.p{animation:none}.t{display:none}}
</style>
${rects.join("\n")}
<path class="p" pathLength="1" d="${path}"/>
<g class="t"><circle r="5" fill-opacity=".25"/><circle r="2"/>
<animateMotion dur="${DUR}s" fill="freeze" path="${path}"/>
<animate attributeName="opacity" from="1" to="0" begin="${DUR}s" dur=".4s" fill="freeze"/></g>
<text x="${PAD}" y="${H - 6}">G21 G90 · RASTER POCKET · ${total} contributions</text>
</svg>
`;
  assert.equal(svg.match(/<rect /g).length, days.length, "rect count != day count");
  writeFileSync(`${outDir}/toolpath-${name}.svg`, svg);
}
console.log(`${days.length} days (${days[0].date}..${days.at(-1).date}), ${total} contributions -> ${outDir}/`);
