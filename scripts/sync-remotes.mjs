#!/usr/bin/env node
/**
 * sync-remotes.mjs — 把本地 main 同时同步到 GitHub(origin) 与 Gitee(gitee)。
 *
 * 契约：三处 main 指向同一个 commit，视为**一个逻辑数据源 + 两个镜像**。
 * 因此每次推送必须两端一起推，禁止只推一端。
 *
 * 安全约束：
 *   - 绝不强推（不带 --force / --force-with-lease）
 *   - 远端领先或分叉时拒绝推送，要求先 fetch + merge/rebase
 *   - 已跟踪文件有未提交改动时拒绝推送（未跟踪文件不阻断）
 *   - 推送后重新 ls-remote 校验三处一致，不一致即非零退出
 *
 * 用法（在仓库根目录执行）：
 *   npm run sync          # 推两端 + 校验
 *   npm run sync:check    # 只校验/报告，不推送
 */
import { execFileSync } from "node:child_process";

const BRANCH = "main";
const REMOTES = ["origin", "gitee"];
const CHECK_ONLY = process.argv.includes("--check-only");

function git(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    const msg = String(e.stderr || e.stdout || e.message || "").trim();
    throw new Error(`git ${args.join(" ")} 失败：${msg}`);
  }
}

/** exit 1 表示「不是祖先」，属于正常判定；其他退出码才是真错误。 */
function isAncestor(ref) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ref, "HEAD"], {
      stdio: "ignore",
    });
    return true;
  } catch (e) {
    if (e.status === 1) return false;
    throw new Error(`git merge-base --is-ancestor ${ref} HEAD 失败：${String(e.stderr || e.message).trim()}`);
  }
}

function remoteHead(remote) {
  const out = git(["ls-remote", remote, `refs/heads/${BRANCH}`]);
  if (!out) throw new Error(`${remote} 上找不到 refs/heads/${BRANCH}`);
  return out.split(/\s+/)[0];
}

function short(sha) {
  return sha ? sha.slice(0, 7) : "(none)";
}

function main() {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== BRANCH) {
    throw new Error(`当前分支是 ${branch}，本脚本只同步 ${BRANCH}；切回 ${BRANCH} 再运行。`);
  }

  const dirty = git(["status", "--porcelain", "--untracked-files=no"]);
  if (dirty && !CHECK_ONLY) {
    throw new Error(`有已跟踪文件未提交，先 commit 再同步：\n${dirty}`);
  }

  const local = git(["rev-parse", "HEAD"]);
  console.log(`本地 ${BRANCH}  = ${short(local)}${CHECK_ONLY ? "  [check-only，不推送]" : ""}`);

  // 把远端真实状态抓到本地跟踪 ref，用于分叉判定（不改动工作区）。
  for (const r of REMOTES) {
    git(["fetch", "--quiet", r, `+refs/heads/${BRANCH}:refs/remotes/${r}/${BRANCH}`]);
  }

  const heads = {};
  for (const r of REMOTES) heads[r] = remoteHead(r);
  console.log(`GitHub main = ${short(heads.origin)}`);
  console.log(`Gitee  main = ${short(heads.gitee)}`);

  const alreadySynced = REMOTES.every((r) => heads[r] === local);
  if (alreadySynced) {
    console.log("✅ 三处一致，无需推送。");
    return;
  }

  // 分叉防护：任一远端出现本地没有的提交，绝不能靠 push 覆盖。
  for (const r of REMOTES) {
    if (heads[r] === local) continue;
    if (!isAncestor(`refs/remotes/${r}/${BRANCH}`)) {
      throw new Error(
        `❌ ${r}/${BRANCH} (${short(heads[r])}) 含有本地没有的提交，已分叉。\n` +
        `   拒绝推送（禁止 --force）。请先：git fetch ${r} ${BRANCH} && ` +
        `git merge ${r}/${BRANCH}（或 rebase），解决冲突后再运行 npm run sync。`
      );
    }
  }

  if (CHECK_ONLY) {
    console.log("🟠 存在待推送的快进提交（check-only 模式未推送）。运行 npm run sync 完成同步。");
    return;
  }

  for (const r of REMOTES) {
    if (heads[r] === local) {
      console.log(`⏭  ${r} 已是 ${short(local)}，跳过。`);
      continue;
    }
    console.log(`→ 推送 ${r} ${BRANCH}:${BRANCH} …`);
    git(["push", r, `${BRANCH}:${BRANCH}`]);
    console.log(`   ${r} 完成。`);
  }

  // 推送后必须重新向远端核实，不能只信 push 的退出码。
  const final = { local, origin: remoteHead("origin"), gitee: remoteHead("gitee") };
  const same = final.local === final.origin && final.origin === final.gitee;
  console.log(`\n校验：local=${short(final.local)} github=${short(final.origin)} gitee=${short(final.gitee)}`);
  if (!same) {
    throw new Error("❌ 推送后三处不一致！请人工检查，不要重复运行本脚本。");
  }
  console.log("✅ 三处完全一致，同步完成。");
}

try {
  main();
} catch (e) {
  console.error(`\n${e.message}`);
  process.exit(1);
}
