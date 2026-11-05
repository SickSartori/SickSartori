// Profile art for a GitHub README: a hero banner and a "constellation" of contribution days (red and black SVGs).
// Usage: node profile.mjs [user] [outDir]
// shortcut: scrapes the public profile HTML, switch to GraphQL + token if GitHub changes the markup.
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const user = process.argv[2] ?? "SickSartori";
const outDir = process.argv[3] ?? "assets";

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

// Deterministic jitter: the sky looks organic but is identical between runs.
const hash = (s) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
};

const SX = 16, SY = 22, PAD = 26, FOOT = 30;
const cols = Math.ceil(days.length / 7);
const W = PAD * 2 + (cols - 1) * SX;
const H = PAD * 2 + 6 * SY + FOOT;
const stars = days.map((d, i) => ({
  ...d,
  i,
  x: PAD + Math.floor(i / 7) * SX + (hash(`${d.date}x`) - 0.5) * 8,
  y: PAD + (i % 7) * SY + (hash(`${d.date}y`) - 0.5) * 10,
}));

// Constellation lines join active days at most 3 days apart: each cluster is a burst of work.
const active = stars.filter((s) => s.level > 0);
const clusters = [[]];
for (const s of active) {
  const run = clusters.at(-1);
  if (run.length && s.i - run.at(-1).i > 3) clusters.push([]);
  clusters.at(-1).push(s);
}
const lines = clusters
  .filter((r) => r.length > 1)
  .map((r) => "M" + r.map((s) => `${s.x.toFixed(1)} ${s.y.toFixed(1)}`).join("L"));

let streak = 0, cur = 0;
for (const d of days) streak = Math.max(streak, (cur = d.level ? cur + 1 : 0));

// Red and black. The art is a dark card, so one theme reads fine on light and dark GitHub pages alike.
const ember = {
  bgA: "#0a0a0b", bgB: "#1c080b", edge: "#3d141a", line: "#ef4444", dust: "#a37a7a", text: "#d4b5b5",
  lv: [null, "#b91c1c", "#dc2626", "#ff4d4d", "#ffe3d6"], grad: ["#ff3b3b", "#ff7a59"], aur: ["#ff2d2d", "#9b1c1c"],
};
const R = [0, 1.6, 2.2, 3, 3.8];
const FONT = `Inter,'Segoe UI',system-ui,-apple-system,sans-serif`; // single quotes: it lands inside style="..."
const MONO = `ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;

const sky = (t) => {
  const dust = stars.filter((s) => !s.level).map((s) => `<circle class="d" cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r=".7"/>`);
  const halos = active.filter((s) => s.level > 1).map((s) => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${R[s.level] * 4}" fill="url(#halo)"/>`);
  const dots = active.map(
    (s) => `<circle class="s" cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${R[s.level]}" fill="${t.lv[s.level]}" style="animation-delay:-${(hash(`${s.date}t`) * 4).toFixed(2)}s"/>`,
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>${user}: ${total} contributions, drawn as a constellation</title>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bgA}"/><stop offset="1" stop-color="${t.bgB}"/></linearGradient>
<radialGradient id="halo"><stop offset="0" stop-color="${t.lv[3]}" stop-opacity=".5"/><stop offset="1" stop-color="${t.lv[3]}" stop-opacity="0"/></radialGradient>
<linearGradient id="tail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.lv[4]}" stop-opacity="0"/><stop offset="1" stop-color="${t.lv[4]}"/></linearGradient>
</defs>
<style>
.d{fill:${t.dust};opacity:.35}
.s{animation:tw 3s ease-in-out infinite alternate}
.m{opacity:0;animation:fly 11s linear infinite}
text{font:11px ${MONO};fill:${t.text}}
@keyframes tw{from{opacity:.5}to{opacity:1}}
@keyframes fly{0%{transform:translate(40px,10px);opacity:0}3%{opacity:1}9%{transform:translate(${W - 240}px,${H - 100}px);opacity:0}100%{transform:translate(${W - 240}px,${H - 100}px);opacity:0}}
@media (prefers-reduced-motion:reduce){.s,.m{animation:none}.m{display:none}}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="url(#bg)" stroke="${t.edge}"/>
${dust.join("\n")}
<path d="${lines.join("")}" fill="none" stroke="${t.line}" stroke-opacity=".4" stroke-width=".9" stroke-linejoin="round"/>
${halos.join("\n")}
${dots.join("\n")}
<line class="m" x1="0" y1="0" x2="64" y2="36" stroke="url(#tail)" stroke-width="1.6" stroke-linecap="round"/>
<text x="${PAD}" y="${H - 14}">${total} contributions · ${active.length} active days · longest streak ${streak} days</text>
</svg>
`;
  assert.equal(svg.match(/class="[ds]"/g).length, days.length, "star count != day count");
  return svg;
};

const hero = (t) => {
  let px = 40;
  const pills = ["C++", "TypeScript", "JavaScript", "Windows", "CAM"].map((p) => {
    const w = Math.round(p.length * 7.4 + 24);
    const out = `<rect x="${px}" y="158" width="${w}" height="26" rx="13" fill="none" stroke="${t.line}" stroke-opacity=".45"/><text x="${px + w / 2}" y="175" text-anchor="middle" style="font-size:12px">${p}</text>`;
    px += w + 10;
    return out;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 210" width="${W}" height="210">
<title>Gabriel Sartori, sviluppatore e collezionista di side project</title>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bgA}"/><stop offset="1" stop-color="${t.bgB}"/></linearGradient>
<linearGradient id="ng" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.grad[0]}"/><stop offset="1" stop-color="${t.grad[1]}"/></linearGradient>
<radialGradient id="a1"><stop offset="0" stop-color="${t.aur[0]}" stop-opacity=".42"/><stop offset="1" stop-color="${t.aur[0]}" stop-opacity="0"/></radialGradient>
<radialGradient id="a2"><stop offset="0" stop-color="${t.aur[1]}" stop-opacity=".5"/><stop offset="1" stop-color="${t.aur[1]}" stop-opacity="0"/></radialGradient>
<pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="${t.edge}" stroke-opacity=".6"/></pattern>
<clipPath id="card"><rect width="${W}" height="210" rx="14"/></clipPath>
</defs>
<style>
.a1{animation:d1 18s ease-in-out infinite alternate}
.a2{animation:d2 22s ease-in-out infinite alternate}
@keyframes d1{to{transform:translate(-90px,24px)}}
@keyframes d2{to{transform:translate(110px,-20px)}}
@media (prefers-reduced-motion:reduce){.a1,.a2{animation:none}}
text{font-family:${MONO};font-size:13px;fill:${t.text}}
</style>
<g clip-path="url(#card)">
<rect width="${W}" height="210" fill="url(#bg)"/>
<rect width="${W}" height="210" fill="url(#grid)" opacity=".5"/>
<circle class="a1" cx="${W - 140}" cy="20" r="230" fill="url(#a1)"/>
<circle class="a2" cx="140" cy="240" r="250" fill="url(#a2)"/>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="209" rx="14" fill="none" stroke="${t.edge}"/>
<text x="42" y="58">@${user}</text>
<text x="40" y="108" style="font-family:${FONT};font-size:48px;font-weight:700;letter-spacing:-1px;fill:url(#ng)">Gabriel Sartori</text>
<text x="42" y="138" style="font-family:${FONT};font-size:16px">Sviluppatore · collezionista di side project</text>
${pills.join("\n")}
</svg>
`;
};

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/sky.svg`, sky(ember));
writeFileSync(`${outDir}/hero.svg`, hero(ember));
console.log(`${days.length} days, ${active.length} active, streak ${streak}, ${lines.length} constellations, ${total} contributions -> ${outDir}/`);
