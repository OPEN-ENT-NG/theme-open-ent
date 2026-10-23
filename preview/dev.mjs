// Static preview of portal-v2.html header (no backend, no Angular).
// Usage: node dev.mjs [theme] [port]   (theme = folder in ../overrides, default "na";
// port defaults to 8080, then the next free one)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const theme = process.argv[2] || "na";
const build = path.join(here, "build", theme);
const lib = path.join(here, "node_modules/entcore-css-lib");
const PORT = Number(process.argv[3] || process.env.PORT || 8080);

const read = (p) => fs.readFileSync(p, "utf8");

function compileCss() {
  fs.rmSync(build, { recursive: true, force: true });
  fs.cpSync(path.join(root, "scss"), path.join(build, "scss"), { recursive: true });
  fs.cpSync(path.join(root, "skins"), path.join(build, "skins"), { recursive: true });
  const ov = path.join(root, "overrides", theme, "css");
  if (fs.existsSync(ov)) fs.cpSync(ov, path.join(build, "scss"), { recursive: true });
  const sass = path.join(here, "node_modules/.bin/sass");
  execFileSync(sass, ["--load-path=" + path.join(here, "node_modules"), "--no-source-map",
    path.join(build, "skins/default/theme.scss"), path.join(build, "theme.css")], { stdio: "inherit" });
}

function i18n() {
  const dict = {};
  const walk = (d) => { for (const f of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name === "fr.json") try { Object.assign(dict, JSON.parse(read(p))); } catch {}
  } };
  walk(path.join(root, "docs/i18n")); walk(path.join(root, "assets/i18n"));
  walk(path.join(root, "overrides", theme, "i18n"));
  return dict;
}

const PORTALS = ["portal-v2", "portal"];

function page(portal) {
  const t = i18n();
  let html = read(path.join(root, portal + ".html"));
  const header = html.match(/<header[\s\S]*?<\/header>/)[0]
    .replace(/<i18n>([^<]+)<\/i18n>/g, (_, k) => t[k.trim()] ?? k)
    .replace(/i18n-title="([^"]+)"/g, (_, k) => `title="${t[k] ?? k}"`)
    .replace(/\[\[skin\.skin\]\]/g, "preview")
    .replace(/ng-show="notificationsOpen"/, 'style="display:none"')
    .replace(/<img data-ng-src[^>]*>/, '<img id="my-photo" alt="" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 48 48\'%3E%3Ccircle cx=\'24\' cy=\'24\' r=\'24\' fill=\'%23ccc\'/%3E%3C/svg%3E" />')
    .replace(/\[\[(nbNewMessages|nbCarbonioUnread)\]\]/g, "3")
    .replace(/<span ng-include="[^"]*"><\/span>/g, "")
    .replace(/\s(ng-[a-z-]+|data-ng-[a-z-]+)="[^"]*"/g, "")
    .replace(/\[\[[^\]]*\]\]/g, "");
  const switcher = PORTALS.map((n) => n === portal ? `<b>${n}</b>` : `<a href="/?portal=${n}">${n}</a>`).join(" | ");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview ${portal} (${theme})</title>
<link rel="stylesheet" href="/skins/default/theme.css">
</head><body><div class="material main wrapper"></div>${header}
<section class="main"><p style="padding:2rem">Preview — thème <b>${theme}</b> — ${switcher}</p></section>
<script>const nb=document.querySelector('.notification-button');if(nb)nb.onclick=()=>{const p=document.querySelector('.notification-popover');p.style.display=p.style.display==='none'?'':'none'}</script>
<script>new EventSource('/events').onmessage=()=>location.reload()</script>
</body></html>`;
}

const clients = new Set();
const mime = { ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const roots = (u) => u.startsWith("/fonts/") ? [path.join(lib, "assets")]
  : u.startsWith("/img/") ? [path.join(root, "overrides", theme), path.join(root, "assets"), path.join(lib, "assets")]
  : u.startsWith("/assets/themes/") ? [] : [];

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    clients.add(res); req.on("close", () => clients.delete(res)); return;
  }
  if (u === "/") {
    const q = new URL(req.url, "http://x").searchParams.get("portal");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(page(PORTALS.includes(q) ? q : PORTALS[0]));
  }
  if (u === "/skins/default/theme.css") { res.writeHead(200, { "Content-Type": "text/css" }); return res.end(read(path.join(build, "theme.css"))); }
  const m = u.match(/^\/assets\/themes\/preview\/(img\/.*)$/);
  const rel = m ? "/" + m[1] : u;
  for (const r of roots(rel)) for (const cand of [path.join(r, rel), path.join(r, "..", rel.replace(/^\/img\//, "img/"))]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      res.writeHead(200, { "Content-Type": mime[path.extname(cand)] || "application/octet-stream" });
      return fs.createReadStream(cand).pipe(res);
    }
  }
  res.writeHead(404); res.end();
});

function listen(port) {
  server.once("error", (e) => {
    if (e.code === "EADDRINUSE" && !process.argv[3] && !process.env.PORT) listen(port + 1);
    else throw e;
  });
  server.listen(port);
}
server.on("listening", () => console.log(`Preview (${theme}) → http://localhost:${server.address().port}`));
listen(PORT);


// the /assets/themes/preview/img/... URL rewritten by the page: serve from theme img
let timer;
function rebuild() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { compileCss(); console.log("rebuilt"); clients.forEach((c) => c.write("data: r\n\n")); }
    catch (e) { console.error("sass error"); }
  }, 150);
}
compileCss();
for (const d of ["scss", path.join("overrides", theme, "css"), "skins"]) {
  const p = path.join(root, d);
  if (fs.existsSync(p)) fs.watch(p, { recursive: true }, rebuild);
}
for (const n of PORTALS) fs.watchFile(path.join(root, n + ".html"), () => clients.forEach((c) => c.write("data: r\n\n")));
