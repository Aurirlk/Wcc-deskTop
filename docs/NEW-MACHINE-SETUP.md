# 换机迁移清单（Clone → 可开发 → 可验证）

> 2026-11-10 · 因开发机更换而编写。目的是让**新机器拉下仓库就能恢复到今天的研究状态**，而不是靠人记忆补环境。当前主仓库是 **Gitee 私有仓库**（项目为半成品，刻意不公开），GitHub 尚未同步，见 §1。
> 本文件是操作清单，不是完成声明；涉及本机实测的数据均标注来源，未在新机器验证的步骤标 🟠。

---

## 0. 一句话结论

✅ 研究成果（文档 + `harness/` 零依赖实现 + `wcc-skill` steering 元数据）**全部是可移植的纯文本**，随仓库走；
🔴 另有五类东西**不会随 git 走**：本机游戏与地图素材、API 凭据、用户级环境变量、IDE 本地配置需要单独带走；桌面 `.lnk` 快捷方式**不必带走、也不该入库**，到新机器用 `scripts/create-shortcuts.py` 重建即可，见 [DEPLOYMENT-SHORTCUTS.md](DEPLOYMENT-SHORTCUTS.md) 与 §5。

---

## 1. 仓库与远端

| 项 | 值 | 备注 |
|---|---|---|
| **当前主仓库（Gitee）** | `https://gitee.com/wei-kaijie/Wcc-deskTop.git` | ✅ 2026-11-10 建仓并推送成功；**私有**（项目为半成品，刻意不公开）、`main`；远端 HEAD 与本地一致、tree 161 条目 |
| GitHub 官方仓库 | `https://github.com/Aurirlk/Wcc-deskTop.git` | 🔴 **仍停在 `12b9169`**：`git push` 因代理 502 + 无凭据失败，本次成果未同步 |
| 本地 `origin` | `https://github.com/Aurirlk/Wcc-deskTop.git` | 已从失效镜像切到官方地址 |
| 本地 `gitee` | `https://gitee.com/wei-kaijie/Wcc-deskTop.git` | 干净 URL，**不含任何凭据**；推送令牌只走一次性 URL |
| 旧镜像 remote | `https://gitclone.com/github.com/Aurirlk/Wcc-deskTop.git` | 🔴 2026-11-10 实测 502 已失效，且只读不能 push |
| 基线 commit | `12b9169` — `feat: WCC desktop AI harness monorepo (v1.2)` | 推送前本地与 GitHub 远端一致 |
| 本次成果提交 | `7fe0922`..`83ced5f`（6 个） | ✅ 已在 Gitee `main` 上 |
| 作者身份 | `WCC Dev <wcc-dev@users.noreply.github.com>` | 沿用原提交（noreply 形式，不含个人邮箱） |

仓库是**私有**的，匿名 `git clone` / API 会返回 404 或 401。新机器请用一次性带令牌的 URL clone，然后立刻把凭据从配置里去掉：

```bash
git clone https://<Gitee用户名>:<私人令牌>@gitee.com/wei-kaijie/Wcc-deskTop.git Wcc-deskTop
cd Wcc-deskTop
git remote set-url origin https://gitee.com/wei-kaijie/Wcc-deskTop.git   # 去掉 URL 里的令牌
git log -6 --oneline          # 应能看到 docs / harness / scripts 相关提交
```

🟠 更省事、且不依赖任何云端认证的恢复方式：直接带走 `D:\净土\WCC-2026-11-10-research.bundle` / `.patch` / `.zip` 三份离线归档（见 §3），在新机器 `git clone <bundle>` 或解压即可。

> 🔴 **不要用 GitHub 地址 clone 后以为拿到了最新成果**：GitHub 此刻仍是 `12b9169`。
> 若之后恢复了 GitHub push 权限，记得把 Gitee 上的 6 个提交补推过去，两边再保持一致。

---

## 2. 基础运行环境

| 依赖 | 要求 | 本机实测值 / 说明 |
|---|---|---|
| Node.js | 20+（建议 22 LTS） | 本机 `22.22.2`；`harness/` 用 Node 内置 `node:test`/`readline`，无需额外包 |
| npm | 随 Node | 本机 10.x 系；国内镜像见下 |
| Python | 3.10+（可选，仅做 `.w3x` 离线解析） | 本机 `D:\Python\python.exe` **3.13.14**；`mpyq` / `PIL` / `numpy` 🔴 **未安装**，需要时从清华 PyPI 镜像装 |
| VS Code + `sumneko.lua` | 可选，Lua 提示 | `.vscode/settings.json` 被 `.gitignore` 排除，新机器需重建（见 §4） |
| Electron | 可选，仅桌面 UI | 本机 **v45.2.3**；`package.json` 声明 `^33.0.0` 🟠 版本声明与实装不一致，属已知项 |

### 国内镜像（避免外网直连）

```bash
npm config set registry https://registry.npmmirror.com
npm config set cache "D:\Programs\npm-cache"        # 换成新机器实际路径
npm config set prefix "D:\Programs\npm-global"
set ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/
```

> ⚠️ 历史踩坑：曾额外设置 `ELECTRON_CUSTOM_DIR=v{{version}}` 导致 404、Electron 只有 npm 包没有二进制。
> **只保留 `ELECTRON_MIRROR`，不要加 `ELECTRON_CUSTOM_DIR`。**

### 安装与回归（新机器必须跑一遍）

```bash
npm install
npm test                 # 基线：27 tests pass
npm run check            # 基线：13 Lua files, 0 issues
node --test harness/test/harness.test.js     # 基线：15/15
node harness/bin/wcc-harness.mjs demo       # 离线全链路，不需要 API key
```

也可以直接双击 `wcc-启动器.bat`，菜单 `[5]` 会在一行里跑 harness demo + selftest。
该启动器已改为**不写死任何机器账号路径**：优先用系统 `PATH` 里的 `node`，找不到才回退到 `%USERPROFILE%\.workbuddy\...`。

> 桌面上的快捷方式不随仓库走。新机器用 `python scripts/create-shortcuts.py --dry-run` 核对路径后生成，
> 详见 [DEPLOYMENT-SHORTCUTS.md](DEPLOYMENT-SHORTCUTS.md)。

---

## 3. 研究成果清单（本次要同步的内容）

| 路径 | 内容 |
|---|---|
| `docs/MAP-GENERATION-PLAN.md` | 拼图 / 借鉴 / 随机生成 / 素材库四路线；人物摆放与触发器的代码凭据；统一文本 IR 架构 |
| `docs/MAP-COMPILE-PIPELINE.md` | **最难一项**：文本化 / 打包 / 真编译三层拆解；w3x2lni CLI、WE Save、JASShelper、Wurst+grill、MIT 打包链；Warcraft 3 MCP Server 源码级档案 |
| `docs/HARNESS-IMPLEMENTATION.md` | 调研 → 代码逐条对账；脚本 manifest、工具注入、零依赖 TUI、WC3 借鉴 |
| `docs/HARNESS-REFERENCE.md` / `FEASIBILITY-REVIEW.md` / `FORGE-INTEGRATION.md` / `ASSETS-GUIDE.md` | Kiro / Strands Harness / Deep Agents 借鉴；方案可行性；forge 生态与许可证边界；素材来源 |
| `harness/` | 14 文件零依赖实现：steering 条件加载、spec 状态机、scratch 卸载、provider preset、budget、hooks、middleware、按需工具注入、TUI、CLI、15 项自测 |
| `wcc-skill/*.md` | 8 份文档写入 steering front matter（**仅新增头部，正文未改**），「文档即配置」 |
| `vendor/wc3-lua-annotations/` | 第三方 War3 Lua API 定义（MIT, Copyright 2019 Lazy Knight，**LICENSE 保留**） |
| `README.md` / `PROJECT-PLAN-2.0.md` | 文档索引、1.26 试玩警告、过期「build 打进 w3x」虚标校正 |

🟠 **补记（2026-11-10 后续，校正本节初稿）**：按「全部成果不要遗漏」的要求，`package-lock.json` 与 `packages/wcc-lua-check/src/cli.js` 最终**已一并提交**（`a26f620 chore: sync local npm install result and lua-check cli line endings`）。二者本质仍是本机 `npm install` 副作用与换行差异，**不是研究成果**；新机器若遇依赖树异常，直接 `npm install` 重新生成即可，不要把这份 lock 当作权威基线。

---

## 4. 需要重建的本地配置（不入库）

`.gitignore` 明确排除了：`node_modules/`、`dist/`、`out/`、`.env*`、`.wcc/`、`.vscode/`、`.idea/`、`*.w3x`、`coverage/`。

其中 `.wcc/` 可能含 `apiKey`，**绝不能提交**。Sidecar 的模型配置走环境变量：

```bat
set WCC_MODEL_BASE_URL=https://api.deepseek.com/v1
set WCC_MODEL_API_KEY=<你的 key>
set WCC_MODEL_NAME=deepseek-chat
```

`.vscode/settings.json` 需重建，关键两项：

```json
{
  "Lua.workspace.library": ["vendor/wc3-lua-annotations"],
  "Lua.runtime.version": "Lua 5.3"
}
```

`wc3-forge` 是外部二进制（**GPL-3.0，不捆绑进 MIT 仓库**），新机器自行安装后设置用户级环境变量：

```powershell
[Environment]::SetEnvironmentVariable("WC3FORGE_EXE", "<安装路径>\wc3-forge.exe", "User")
```

> 🟠 已知：本机设置后当前 shell 曾读不到该变量，需要**重新登录或重启资源管理器**；`node harness/bin/wcc-harness.mjs probe` 应显示路径而不是 `(unset)`。

---

## 5. 🔴 换机前必须单独带走（git 里没有）

| 类别 | 本机位置 | 说明 |
|---|---|---|
| 游戏本体与原版 WE | `D:\净土\kkkk\魔兽争霸3冰封王座\` | `worldedit.exe`、`war3.mpq`(451 MB)；**版本 1.26.0.6401** |
| 地图素材库 | `D:\净土\kkkk\魔兽争霸3冰封王座\Maps\` | 实测 **559 个 `.w3x` + 60 个 `.w3m`**；`.gitignore` 排除 `*.w3x`，不会入库 |
| 个人数据 | `D:\360MoveData\` | 魔兽存档、QQ/微信数据，曾确认是**唯一副本**，不可丢 |
| 凭据 | 环境变量 / `.wcc/` / GitHub PAT / **Gitee 私人令牌** | API key 与 git 凭据不随仓库走；令牌只走一次性 URL，不写入 `.git/config` |
| 工具箱与报表 | `D:\Desktop\开源工具箱\`、`D:\电脑清洁报告.md`、`D:\Python\` | 与项目无关但属于本机整理成果 |
| 桌面快捷方式 | `D:\Desktop\WCC 控制台.lnk` 等 4 个 + 工具箱 20 个 | 🔴 **不入库、不必带走**：目标全写死 `D:\...` 绝对路径；本机生成脚本当初也未入库。新机器用 `scripts/create-shortcuts.py` 重建，见 [DEPLOYMENT-SHORTCUTS.md](DEPLOYMENT-SHORTCUTS.md) |

---

## 6. 版本硬约束（换机时最容易踩）

PowerShell 实测 `war3.exe` / `game.dll` = **1.26.0.6401 经典版**，而 `README.md` 自述 **Lua 1.31+**。因此：

1. 🔴 本机 1.26 **只跑 JASS**；`war3map.lua` 与全套 `wcc-lib` 在这台机器上不能直接试玩。
2. 🔴 官方「文件夹地图 / auto-import」是 1.31+ 能力，本机没有。
3. 🔴 `YElwiddi/warcraft-3-mcp-server` 的 `wct.ts` 只接受 modern 版本标记、`wtg.ts` 的 classic 格式只读不写 → 其招牌能力在本机大概率拒写。
4. 🔴 本机**没有任何编译器**（无 `w2l` / `jasshelper` / `pjass` / `grill` / `common.j` / `blizzard.j`）。

> 换机是处理这个错配的最好时机：**要么新机器装 1.31+ 保住 Lua 资产，要么明确双轨并在 IR 里带 `targetPatch`**。
> 详见 `docs/MAP-COMPILE-PIPELINE.md` §8 的 10 项待补资料与目标补丁决策。

---

## 7. 已知红线（不要误以为已完成）

- `npm run build` 仍是 `echo` 占位；无 `electron-builder`，**桌面端尚不能打包分发**。
- 仓库内**零 `.w3x`**；`build_map` 只产 `war3map.lua` 脚本包，不等于「编译进地图」。
- 编辑器期摆件（预置单位 / 树 / 区域 / GUI 触发器）**一行实现都没有**，改图目前依赖外部工具链。
- forge / Warcraft 3 MCP Server 均**未在本机联调**，文档中的能力描述是源码与 README 调研结论，不是实测通过。
- 交互式 TUI 未在真 TTY 验收，仅有非 TTY 静态降级 `tui --static`。

---

## 8. 迁移完成判定

在新机器执行下面四条，全部符合才算恢复到位：

- [ ] `git log` 能看到本次研究成果的 6 个提交，且 `git remote get-url gitee` 指向私有 Gitee 仓库（不是 gitclone.com）；带凭据的 `git ls-remote gitee main` 的 HEAD 与本地一致
- [ ] `npm test` 27 pass、`npm run check` 13 files / 0 issues
- [ ] harness 自测 15/15、`demo` 全链路跑通（离线，无需 key）
- [ ] 明确记下新机器的目标补丁版本，并回填到 `docs/MAP-COMPILE-PIPELINE.md` 的目标补丁决策
- [ ] 桌面入口已用 `scripts/create-shortcuts.py` 重建，且 `--list` 读回的目标全部指向本机真实路径
