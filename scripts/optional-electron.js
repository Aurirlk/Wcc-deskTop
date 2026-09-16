#!/usr/bin/env node
/** Soft-fail postinstall: electron download may fail offline; core packages still work. */
try {
  const fs = require("fs");
  const path = require("path");
  const electronPkg = path.join(__dirname, "..", "node_modules", "electron", "package.json");
  if (fs.existsSync(electronPkg)) {
    console.log("[wcc] electron present");
  } else {
    console.log("[wcc] electron not installed — desktop shell needs network; sidecar/check still work");
  }
} catch {
  /* ignore */
}
