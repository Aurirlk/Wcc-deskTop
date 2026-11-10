#!/usr/bin/env node
/**
 * Postinstall probe for the optional Electron binary.
 *
 * Soft-fail by design: a missing binary must NOT break `npm install` on an
 * offline machine (sidecar, lua-check and harness all work without Electron).
 * But it must also NOT claim "electron present" merely because the npm package
 * folder exists — the download step is separate and often fails behind a proxy.
 * See docs/FEASIBILITY-REVIEW.md:60-62 and NEXT-DEVELOPMENT-PLAN.md N2.
 */
const fs = require("fs");
const path = require("path");

function candidates(electronDir, platform = process.platform) {
  if (platform === "win32") return ["electron.exe"];
  if (platform === "darwin") return ["Electron.app/Contents/MacOS/Electron"];
  return ["electron"];
}

function probe() {
  const electronDir = path.join(__dirname, "..", "node_modules", "electron");
  const pkg = path.join(electronDir, "package.json");
  if (!fs.existsSync(pkg)) {
    return { present: false, reason: "npm package not installed" };
  }

  // Electron's install.js writes path.txt pointing at the extracted dist folder.
  const pathTxt = path.join(electronDir, "path.txt");
  let distDir = path.join(electronDir, "dist");
  if (fs.existsSync(pathTxt)) {
    const rel = fs.readFileSync(pathTxt, "utf8").trim();
    if (rel) distDir = path.join(electronDir, rel);
  }
  if (!fs.existsSync(distDir)) {
    return { present: false, reason: `dist folder missing (${path.relative(electronDir, distDir)})` };
  }

  const found = candidates(electronDir).find((rel) => fs.existsSync(path.join(distDir, rel)));
  if (!found) {
    return { present: false, reason: `binary missing under ${path.relative(electronDir, distDir)}` };
  }
  return { present: true, binary: path.join(distDir, found) };
}

try {
  const r = probe();
  if (r.present) {
    console.log(`[wcc] electron binary present: ${path.relative(path.join(__dirname, ".."), r.binary)}`);
  } else {
    console.log(`[wcc] electron NOT usable: ${r.reason}`);
    console.log("[wcc]   -> `npm run dev:desktop` will fail until the binary is downloaded.");
    console.log("[wcc]   -> sidecar / lua-check / harness do NOT need Electron and still work.");
    console.log("[wcc]   -> retry with a mirror (do NOT set ELECTRON_CUSTOM_DIR):");
    console.log("[wcc]      npm_config_electron_mirror=https://npmmirror.com/mirrors/electron/ npm rebuild electron");
    console.log("[wcc]      (PowerShell: $env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'; npm rebuild electron)");
  }
} catch (e) {
  // Soft-fail: never break install because of a probe error, but stay honest.
  console.log(`[wcc] electron probe failed, treating as NOT usable: ${e.message || e}`);
}
