# P0 悬空项处置结论（2026-11-10）

> 对应 [NEXT-DEVELOPMENT-PLAN.md](NEXT-DEVELOPMENT-PLAN.md) 附录 A 的 N5 / N6（均已处置），以及 P0-6 / P0-7。
> 本文只记录**结论与依据**，不改历史快照、不新增第二份规范。

## N5 — `@wcc/shared`：冻结，不补齐也不删除

**结论：冻结（frozen placeholder），P3 再决定重构或移除。**

依据（均为本机核查）：
- 目录仅 3 个文件：`package.json`、`src/index.ts`（65 行纯类型）、`tsconfig.json`；**无 `dist/`**。
- `package.json` 的 `main: dist/index.js`、`types: dist/index.d.ts` 指向不存在的产物。
- 全仓 Grep `@wcc/shared` → **零引用**（`main.js` / `preload.cjs` 用的是字面量 `wcc:status` / `wcc:chat`）。
- `src/index.ts:39-50` 的 `IPC` 常量名（`wcc:sidecar:status`、`wcc:chat:send`、`wcc:tool:approval`）与实际 IPC 名**不一致**。

**为什么不补齐**：它是纯类型包，没有运行时消费者；现在补齐等于在没有真实需求的情况下发明一套协议名，
会与 `main.js` / `preload.cjs` 已工作的 IPC 产生第二份真相（违反 `HARNESS-IMPLEMENTATION.md:176`「双数据源不行」）。
**为什么不删除**：它在 npm workspaces 里、是 git 跟踪文件，删除会影响 lockfile 与潜在的未来类型复用；
且用户明确要求保留未跟踪/历史资产，不做无必要破坏。

**防呆**：新增 `packages/wcc-shared/test/status.test.js`，断言「无 dist / 无运行时 import / IPC 名未对齐」，
防止有人误以为它可用而直接 import，也防止它悄悄变成第二份协议真相。
P3 打包时二选一：① 若确需共享类型 → 先对齐 IPC 名再 `tsc` 产出 dist；② 否则整包移除并更新 lockfile。

## N6 — `wcc-lib/wcc-hotreload.lua`：标注为「WC3 目标环境不可用」，不纳入战役分发

**结论：保留文件（历史资产），但明确标注不可用于 WC3 Lua 目标环境，且不进入 `build_map` 分发清单。**

依据：
- 该模块依赖 `package.loaded` 与原生 `require`（`wcc-hotreload.lua:17/35/49`）。
- WC3 原生 Lua **没有 `require`**；`build-map.js:152` 的产物说明明确用自造 `__wcc_require` 内联依赖。
- 因此真机上 `Init()` 走 `:17-20` 降级返回 `false`，模块实际不可达——**不是 stub，是环境不可达**。
- 当前 `bundleCampaign` 只内联 `require` 图可达的模块，`wcc-hotreload.lua` 未被任何入口 require，
  故不会进入 `war3map.lua`；但它仍会出现在 `src-tree/` 源码副本里，容易被误用。

**处置**：
1. 在文件头加醒目注释，写明目标环境限制与正确用途（仅开发期调试思路，线上战役禁止 `Init`）。
2. `build-map.js` 的产物 `README.md` 增加一条说明：`src-tree/` 中的 `wcc-hotreload.lua` 不可用于 WC3。
3. 在 [NEXT-DEVELOPMENT-PLAN.md](NEXT-DEVELOPMENT-PLAN.md) 附录 A 的 N6 标注「已处置」（已履行）。
4. **不删除**：用户已明确要求保留 `wcc-lib` 与历史资产；且它作为「思路记录」有价值。

## P0-6 — `AGENTS.md`

**结论：仓库根 `AGENTS.md` 已建立，定位为「唯一入口指针 + 仓库级工程约定」，不复述铁律全文。**

- 规范唯一权威仍是 `wcc-skill/skill.md`（§2 铁律 / §4 输出协议 / §5-6 违禁与质检）。
- `AGENTS.md` 只做指路、裁决顺序、验证命令、证据等级、分支远端、不入库清单、范围红线。
- `harness/src/steering.js` 的 `collectSteering` / `createSteering` 增加可选 `agentsFile`，
  `createHarness` 在仓库根存在 `AGENTS.md` 时自动纳入；front matter 为 `mode: always`，
  由 harness 自测断言命中。**双表面可以，双数据源不行** —— 未复制任何铁律段落。

## 验收命令

```bash
npm test                                   # sidecar + lua-check + harness 全量
npm run check                              # 0 errors / 3 warnings，ok=true
node harness/bin/wcc-harness.mjs demo      # EXIT=0
node scripts/optional-electron.js          # 必须报 NOT usable，不得谎报 present
```
