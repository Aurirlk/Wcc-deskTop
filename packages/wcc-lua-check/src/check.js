/**
 * WCC Lua static checker (Node, zero deps).
 * Heuristic rules — not a full parser. Treat warnings as review prompts.
 */
import fs from "node:fs";
import path from "node:path";

const FORBIDDEN_CALLS = [
  { re: /\bWait\s*\(/, rule: "no-wait", message: "禁用 Wait()，改用 wcc-timer.SetTimeout/SetInterval" },
  { re: /\bTriggerSleepAction\s*\(/, rule: "no-trigger-sleep", message: "禁用 TriggerSleepAction，改用计时器" },
  { re: /\bPolledWait\s*\(/, rule: "no-polled-wait", message: "禁用 PolledWait，改用计时器" },
];

const FAKE_APIS = [
  {
    re: /\bSetUnitMaxMana\s*\(/,
    rule: "no-fake-api",
    message: "疑似虚构 API SetUnitMaxMana，应使用 BlzSetUnitMaxMana",
  },
  {
    re: /\bSetUnitAttackDamage\s*\(/,
    rule: "no-fake-api",
    message: "疑似虚构 API SetUnitAttackDamage；用 BlzSetUnitBaseDamage / 攻击属性表",
  },
  {
    re: /\bQuestGetItems\s*\(/,
    rule: "no-fake-api",
    message: "QuestGetItems 不可靠/未文档化；请保存 QuestItemCreate 返回句柄",
    severity: "warning",
  },
  {
    re: /\bCreateLocation\s*\(/,
    rule: "no-fake-api",
    message: "无 CreateLocation；应使用 Location(x,y)",
  },
];

function stripLineComment(line) {
  return line.replace(/--.*$/, "");
}

function readFiles(dirOrFile, acc = []) {
  const st = fs.statSync(dirOrFile);
  if (st.isFile()) {
    if (dirOrFile.endsWith(".lua")) acc.push(dirOrFile);
    return acc;
  }
  for (const name of fs.readdirSync(dirOrFile)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    readFiles(path.join(dirOrFile, name), acc);
  }
  return acc;
}

function checkSource(file, source) {
  const issues = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((line, i) => {
    const ln = i + 1;
    const code = stripLineComment(line);
    if (!code.trim()) return;

    for (const rule of FORBIDDEN_CALLS) {
      if (rule.re.test(code)) {
        issues.push({ file, line: ln, rule: rule.rule, message: rule.message, severity: "error" });
      }
    }
    for (const rule of FAKE_APIS) {
      if (rule.re.test(code)) {
        issues.push({
          file,
          line: ln,
          rule: rule.rule,
          message: rule.message,
          severity: rule.severity || "error",
        });
      }
    }

    // GetLocalPlayer assigned to local / used in if → possible desync
    if (/GetLocalPlayer\s*\(/.test(code)) {
      const isDisplay = /DisplayTimedTextToPlayer|DisplayTextToForce/.test(code);
      const isLogic =
        /^\s*local\s+\w+\s*=/.test(code) || /if\s+[^\n]*GetLocalPlayer/.test(code);
      if (isLogic && !isDisplay) {
        issues.push({
          file,
          line: ln,
          rule: "desync-local-player",
          message: "GetLocalPlayer 参与逻辑赋值可能 desync；仅用于本地 UI 显示",
          severity: "warning",
        });
      }
    }

    // Location created without nearby RemoveLocation
    if (/\bLocation\s*\(/.test(code) && !/SafeCreateLocation|RemoveLocation|ensureCamLoc/.test(code)) {
      const window = lines.slice(i, Math.min(lines.length, i + 20)).join("\n");
      const m = /local\s+(\w+)\s*=\s*.*\bLocation\s*\(/.exec(code);
      const varName = m ? m[1] : null;
      const removes = varName
        ? new RegExp(`RemoveLocation\\s*\\(\\s*${varName}`).test(window)
        : /RemoveLocation\s*\(/.test(window);
      if (!removes) {
        issues.push({
          file,
          line: ln,
          rule: "location-leak",
          message: "Location 创建后 20 行内未见 RemoveLocation",
          severity: "warning",
        });
      }
    }

    if (/\bCreateGroup\s*\(/.test(code)) {
      const window = lines.slice(i, Math.min(lines.length, i + 30)).join("\n");
      if (!/DestroyGroup\s*\(/.test(window)) {
        issues.push({
          file,
          line: ln,
          rule: "group-leak",
          message: "CreateGroup 后 30 行内未见 DestroyGroup",
          severity: "warning",
        });
      }
    }

    if (/string\.sub\s*\(/.test(code) && /index|displayed|char/i.test(code)) {
      issues.push({
        file,
        line: ln,
        rule: "utf8-byteslice",
        message: "string.sub 可能切断 UTF-8；中文请用字符步进",
        severity: "warning",
      });
    }

    if (/EVENT_PLAYER_UNIT_DEATH/.test(code) || /GetTriggerUnit/.test(code)) {
      const window = lines.slice(i, i + 25).join("\n");
      if (/RemoveUnit\s*\(/.test(window) && !/CreateTimer|SetTimeout|SafeRemoveUnit/.test(window)) {
        issues.push({
          file,
          line: ln,
          rule: "death-remove-unit",
          message: "死亡/触发上下文直接 RemoveUnit，应延迟",
          severity: "warning",
        });
      }
    }
  });

  return issues;
}

export function checkPaths(paths) {
  const files = [];
  for (const p of paths) files.push(...readFiles(p));
  const issues = [];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    issues.push(...checkSource(f, src));
  }
  const errors = issues.filter((i) => i.severity === "error");
  return { files: files.length, issues, ok: errors.length === 0 };
}

export function formatReport(report, cwd = process.cwd()) {
  const lines = [
    `wcc-lua-check: ${report.files} files, ${report.issues.length} issues, ok=${report.ok}`,
  ];
  for (const i of report.issues) {
    const rel = path.relative(cwd, i.file).replace(/\\/g, "/");
    lines.push(`  ${i.severity.toUpperCase()}  ${rel}:${i.line}  [${i.rule}] ${i.message}`);
  }
  return lines.join("\n");
}
