#!/usr/bin/env node
import path from "node:path";
import { checkPaths, formatReport } from "./check.js";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: wcc-lua-check <dir-or-file> [...]");
  process.exit(2);
}

const report = checkPaths(args.map((a) => path.resolve(a)));
console.log(formatReport(report));
process.exit(report.ok ? 0 : 1);
