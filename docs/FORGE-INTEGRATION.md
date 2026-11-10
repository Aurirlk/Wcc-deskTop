# WCC 如何融入 wc3-forge 生态（查证结论与行动方案）

> **2026-11-10 仓库状态补记（当日二次校正）**：本文撰写时「未 git commit / 未推送 / origin=gitclone.com」均为当时状态；当天成果已全部提交（`7fe0922`..`ef5a9be`，7 个）并推送到 Gitee **私有**仓库 `wei-kaijie/Wcc-deskTop`（项目为半成品，刻意不公开）。**当日稍后已完成三处同步**：以 Gitee 最新提交为基准合并了 GitHub 原分叉与本地改动，本地 `main`、GitHub `Aurirlk/Wcc-deskTop`、Gitee `wei-kaijie/Wcc-deskTop` 的 `main` 均已对齐（合并提交 `d8ccdfb`）；GitHub **不再**停在 `12b9169`。
> 此后仓库持续开发，**最新 HEAD 一律以 `git log -1` / `git ls-remote` 为准，本文不再跟踪具体 commit**；开发主线与排期见 [NEXT-DEVELOPMENT-PLAN.md](NEXT-DEVELOPMENT-PLAN.md)，换机说明见 [NEW-MACHINE-SETUP.md](NEW-MACHINE-SETUP.md) §1。

> 查证日期：2026-11-09 · 依据 GitHub API / README / CLAUDE.md / CREDITS.md / LICENSE 实测
> 目标对象：`StephenSHorton/wc3-forge` v1.0.7
> ⚠️ 状态更新（11-09 晚）：WCC 侧已落地 `harness/` 层，把「C2：forge 当增强 MCP 执行层」具体化为
> `forge_*` 默认不注入、external 需显式审批、大结果落盘的机制，见
> [`docs/HARNESS-IMPLEMENTATION.md`](HARNESS-IMPLEMENTATION.md) §3。**独立 stdio MCP server 仍未写，
> 提案 Issue / PR 仍未发，forge 仓库一行代码未改，GPL 边界结论不变。**

---

## 0. 直接回答

| 你的问题 | 答案 |
|---|---|
| 能不能提 PR？ | ✅ **能，而且不需要申请、不需要权限**。fork 后提 PR 是 GitHub 开源的基本机制，任何人都可提。 |
| 能不能「申请加入创作」？ | 🟠 GitHub **没有「申请成为协作者」的按钮**。写权限只能由仓库 owner 邀请；现实路径是先提案 Issue → 做 1–2 个高质量小 PR → 建立信任后被邀请。 |
| 该把 WCC 整个 PR 进去吗？ | 🔴 **不建议**。见第 2 节许可证红线与第 3 节路径对比。 |
| 那 PR 用来做什么？ | ✅ 用来做**文档级收录** + 给 forge 修你真实踩到的小 bug，作为建立信任的敲门砖。真正的融入走 MCP 协议，**不需要 PR**。 |

---

## 1. 仓库实情（决定你该怎么开口）

| 项 | 实测值 | 含义 |
|---|---|---|
| 许可证 | **GPL-3.0-or-later** | 与你 WCC 的 MIT 冲突风险，见第 2 节 |
| 状态 | README 自述 **alpha**；14★ / 2 forks | 早期项目，需要外部帮助但有强主张 |
| 贡献者 | **仅 2 人**：`StephenSHorton` 493 commits、`claude` 1 commit | 单人 + AI 辅助开发 |
| PR 历史 | 25 个 PR **全部由维护者自己从自己分支开并合并** | ⚠️ **至今没有任何外部 PR 先例**——不是拒绝，是还没发生过 |
| CONTRIBUTING.md | ❌ **不存在**（只有 `CLAUDE.md` / `CREDITS.md` / `SECURITY.md` / `CHANGELOG.md`） | 没有明文贡献流程，提案尤其重要 |
| PR / Issue 模板 | ❌ 无（`.github/` 只有 `FUNDING.yml` + 2 个 workflow） | 格式自由，但更要写得清楚 |
| Discussions | ❌ 未开启；Wiki ✅ 开启 | **提案只能开 Issue** |
| 沟通渠道 | README / SECURITY.md / FUNDING.yml 均未给 Discord 链接（但 PR #32 标题提到 "Discord feedback"，社区应存在于别处） | 先在 Issue 里问，别猜 |
| 最近活跃 | 最后 push 2026-10-28；v1.0.7 发布于 2026-09-05，之后仅 2 个 CI 清理提交 | 低频维护，别期待快速回应 |
| 技术栈 | Go + Svelte/TS（Wails 单二进制）；`mcp/` 是 **TypeScript** stdio server，为 152 工具目录的 source of truth | `mcp/` 是唯一与你 Node/TS 栈重叠处 |
| 加功能成本 | README 明写：「Adding a feature usually means adding it on both surfaces at once」（GUI + MCP 双表面） | 硬改核心成本很高 |
| 好消息 | 维护者**自己用 Claude Code 开发**（有 `CLAUDE.md`、`claude` 贡献者账号、产品定位即 "designed to be driven by Claude Code"） | 对「给 Claude Code 补魔兽领域知识」这类贡献，理念天然契合 |

---

## 2. 🔴 许可证红线（最重要，先读）

| 方向 | 判定 |
|---|---|
| 把 WCC（MIT）代码贡献进 forge（GPL-3.0） | ✅ 允许，MIT 兼容 GPL。但**合进去的那部分随 forge 以 GPL 分发**；你自己的 WCC 仓库仍可保持 MIT。 |
| 把 forge（GPL-3.0）代码复制进 WCC（MIT） | 🔴 **危险** —— 那部分会强制 WCC 整体转为 GPL-3.0，你失去 MIT 的自由度。 |
| forge 能不能改许可证 | ❌ 基本不能。`CREDITS.md` 明写 GPL-3.0 源于 **HiveWE (GPL-3.0)** 的移植，是继承义务。 |

**因此唯一安全的对接方式**：WCC 与 forge **只走进程间 MCP 协议通信，不复制任何 forge 源码**。
两边各自独立仓库、独立许可证，谁也不污染谁。这也正好等于第 3 节的 L2 方案。

> 特别提醒：不要为了「对齐协议」去抄 `mcp/src/discovery.ts` 或 `internal/bridge/` 的实现。
> 你需要的信息（JSON-RPC 2.0 / NDJSON over 127.0.0.1 / `~/.wc3-forge/mcp/<pid>.lock` / `params._token`）
> **只是公开协议描述**，不是代码；自己按描述实现即可，你 `docs/forge-protocol.md` 里已经记全了。

---

## 3. 三条融入路径对比

| | L1 文档级 | **L2 协议级（推荐）** | L3 代码级 |
|---|---|---|---|
| 做法 | 在 `site/content/docs/` 加一页 "Companion tools: WCC"，或 README/CREDITS 互链 | WCC 做成**独立 stdio MCP server**，与 forge **并列注册**给 Claude Code | 把 Lua 铁律/check 做进 forge 的 `mcp/src/` 工具目录或 Go 核心 |
| 要不要 PR | 需要（小 PR） | **完全不需要** | 需要（大 PR） |
| 许可证风险 | 零 | **零**（进程隔离） | 有（GPL 传染 + 双栈） |
| 成本 | 极低（一个 .mdx） | 中（几周，但全在你自己仓库） | 高（要写 Go + Svelte，且 GUI/MCP 双表面） |
| 被接受概率 | 中高 | **100%（自己就能上线）** | 低（无外部 PR 先例、单人维护、alpha 期强主张） |
| 谁受益 | forge 文档更完整 | 两边用户同时受益，WCC 立刻可用 | forge 变重 |

**核心判断**：
> MCP 是**进程间协议**——「融入生态」不等于「把代码合并进仓库」。
> Claude Code 允许同时注册多个 MCP server，WCC 只要能被 `claude mcp add wcc ...` 注册，
> 就在同一个 Agent 会话里与 forge 协同了，**forge 一行代码都不用改，也不需要维护者批准**。

示意（你 `PROJECT-PLAN.md` §六 Phase 6 已写过这条路：「可选：将 `wcc-mcp` 以 stdio 发布，供 Claude Code 等复用」）：

```bash
claude mcp add wc3-forge --scope user -- "D:\Programs\wc3-forge\wc3-forge.exe" --mcp
claude mcp add wcc        --scope user -- node "D:\净土\Wcc-deskTop\packages\wcc-mcp\dist\index.js"
# 同一会话里：forge_* 负责改图，wcc_* 负责 Lua 铁律 / lua_check / 战役模式
```

---

## 4. 建议的行动顺序

1. **先把 L2 跑通再开口**（最重要）。维护者是工程师，看到「能跑的互补 MCP」会认真对待；空口说「我想合作」说服力弱。
   - 你现在已有：`wcc-skill`、`wcc-lua-check`、Sidecar、`docs/forge-protocol.md`、本机 forge v1.0.7 + `WC3FORGE_EXE`。
2. **开一个提案 Issue**（草稿见第 5 节），语气是「我做了个互补的领域层，是否愿意互链 / 我能否贡献一个小 PR」，不是「我要加入你们」。
3. **提 1–2 个小 PR** 建立信任，优先选：
   - 文档站加 Companion tools 页（`site/content/docs/*.mdx`，纯 Markdown，零风险）
   - 或你在实际对接中**真实踩到的 forge bug** 的修复（最有含金量）
4. **再谈协作权限**。等维护者主动邀请；不要在第一条消息里提「想成为 collaborator」。
5. L3 等对方明确表示愿意改核心、且已有多次合并记录后再议。

---

## 5. 提案 Issue 草稿（英文，可直接复制）

> 标题：`Proposal: companion MCP for WC3 campaign logic + docs cross-link?`

```markdown
Hi — I'm the author of WCC (Warcraft Campaign Craft, MIT):
https://github.com/Aurirlk/Wcc-deskTop

First, thanks for wc3-forge. The `--mcp` bridge is the first thing that made
AI-assisted WC3 map editing actually practical, and I've been running v1.0.7
locally with Claude Code.

**What WCC is (and isn't)**

WCC is not another map editor. It is a *domain layer* for the same agent
session: a set of Warcraft-specific Lua rules and a static checker
(no Wait / TriggerSleepAction, safe handle destruction, desync-safe
GetLocalPlayer usage, UTF-8), plus reusable campaign patterns
(dialogue / quests / spawn waves / boss phases) and a Lua runtime library.
It exposes these as a small standalone stdio MCP server, so Claude Code can
have both `forge_*` (map data) and `wcc_*` (logic quality) registered at once.

It deliberately does **not** duplicate any of the 152 forge tools, and it
does **not** copy any forge source — the two projects talk only over the
public MCP/JSON-RPC protocol. WCC stays MIT; forge stays GPL-3.0.

**What I'd like to ask**

1. Would you be open to a small docs PR adding a "Companion tools" page
   (or a short link in the README) pointing at WCC? Happy to keep it to one
   page and match your site's MDX conventions.
2. More generally: is there any interest in documenting a
   "domain MCP + forge" pattern in the Claude Code guide?
3. If you'd rather keep the docs focused, no problem at all — I'll keep WCC
   fully standalone and just link to forge from my side.

While integrating, I hit [OPTIONAL: describe one concrete issue you actually
found, with repro]. I can send a focused fix PR if that's useful.

No rush, and thanks again for the project.
```

> 使用提示：`[OPTIONAL]` 那句**只有你真的踩到 bug 时才写**，别编。
> 编造问题会直接毁掉第一印象（你自己对文档虚假声明一向很敏感）。

---

## 6. 免翻墙提交 PR 的实操（本机实测）

| 通道 | 实测 | 说明 |
|---|---|---|
| `https://github.com` | **200** | 网页与 API 均可达 |
| `https://api.github.com` | **200** | Python `urllib` 稳定；未认证限流 60 次/小时 |
| `https://gh-proxy.com` | **200** | 可加速 `git clone` |
| `raw.githubusercontent.com` | curl 返回 000，**Python urllib 可用** | 读文件请用 `D:\Python\python.exe` |
| `gitclone.com`（旧 remote，已弃用） | 镜像 | 🔴 **只读，不能 push、不能提 PR**；2026-11-10 实测 502 已失效。提 PR 必须走 `github.com` 原地址 |

**最省事路径（零 git、零梯子，适合 L1 文档 PR）**：
1. 浏览器打开 `https://github.com/StephenSHorton/wc3-forge` → 点 **Fork**
2. 在你的 fork 里进入 `site/content/docs/` → 点 **Add file → Create new file**
3. 粘贴内容，勾选 **「Create a new branch for this commit and start a pull request」**
4. 填标题/说明 → **Propose changes**

全程网页操作，不需要 clone、不需要 push、不需要梯子。

**稍大改动**：本地 `git clone https://gh-proxy.com/https://github.com/StephenSHorton/wc3-forge.git` 加速拉取，
但 **push 必须改回 `https://github.com/<你的账号>/wc3-forge.git`**（镜像只读）。
本会话沙箱里 `git clone github.com` 被拦（Empty reply），你自己机器未必，两条路都留着。

---

## 7. 别做的事

- ❌ 不要在第一条 Issue 里申请 collaborator / write 权限。
- ❌ 不要一次性甩一个把 WCC 整体搬进 forge 的大 PR（无先例、单人维护、双表面要求、GPL）。
- ❌ 不要把 forge 的 Go/TS 源码复制进 MIT 的 WCC。
- ❌ 不要批量改 forge 的格式/风格（维护者 493 commits 有自己的强约定，见 `CLAUDE.md`）。
- ❌ 不要编造「集成时发现的 bug」当敲门砖。
