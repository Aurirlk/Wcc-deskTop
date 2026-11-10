# 部署快捷方式建议（换机 / 新机器场景）

> 2026-11-10 · 本文是**建议 + 本机实测记录**，不是「已完成部署」的声明。
> 标记约定：✅ 本机实测或已落地 ｜ 🟠 建议 / 尚未在新机器验证 ｜ 🔴 未做 / 禁止事项。
> 配套阅读：[NEW-MACHINE-SETUP.md](NEW-MACHINE-SETUP.md)（迁移清单）、[MAP-COMPILE-PIPELINE.md](MAP-COMPILE-PIPELINE.md)（目标补丁决策）。

---

## 0. 一句话结论

换机后**唯一随 git 走的启动入口是仓库内的 `wcc-启动器.bat`**；桌面上那些 `.lnk` 全是机器本地产物，目标写死绝对路径，**必须在新机器重新生成，绝不能提交进仓库**。

为让这一步可复制，本轮新增了随仓库走的生成器 `scripts/create-shortcuts.py`：零第三方依赖、不写死盘符或账号路径、可选工具缺失时跳过而不伪造、生成后逐个读回校验。✅ 本机已实测通过。

---

## 1. 本机现状（2026-11-10 实测）

### 1.1 桌面位置

✅ `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders\Desktop` = **`D:\Desktop`**（用 Python `winreg` 读取）。
本机桌面确实已迁移到 D 盘，但这是**本机状态**，不是部署动作：新机器不要求改注册表，生成器会自行读取当前用户的桌面路径。

### 1.2 现有 WCC 相关快捷方式（用 `IShellLinkW` 逐个读回，非猜测）

| 位置 | 名称 | 目标 | 工作目录 | 说明 |
|---|---|---|---|---|
| `D:\Desktop\` | `WCC 控制台.lnk` | `D:\净土\Wcc-deskTop\wcc-启动器.bat` | `D:\净土\Wcc-deskTop` | 描述写着「Sidecar/Check/Test/Desktop」 |
| `D:\Desktop\` | `Wcc-deskTop 魔兽AI编辑工具.lnk` | `D:\净土\Wcc-deskTop`（文件夹） | 同左 | 命名与其余两个不统一 |
| `D:\Desktop\` | `wc3-forge.lnk` | `D:\Programs\wc3-forge\wc3-forge.exe` | `D:\Programs\wc3-forge` | 外部 GPL-3.0 二进制 |
| `D:\Desktop\` | `VScode.lnk` | `D:\Programs\VSCode\Code.exe` | `D:\Programs\VSCode` | 非标准安装路径 |
| `D:\Desktop\开源工具箱\` | 20 个 `.lnk`（含 `Python.lnk` → `D:\Python\python.exe`、`VS Code.lnk`） | 各种 `D:\Programs\...` | — | 沿用「`[点击安装] xxx.lnk`」命名未安装项 |

### 1.3 🔴 关键缺口

- **生成脚本当初没有入库**。当初是用临时的 `shortcut.py`（Win32 `IShellLinkW` + `IPersistFile`）逐个创建的，本轮在 D 盘与 Temp 全盘搜索**未找到该文件** → 换机后无法复用，只能重建。
- **这些 `.lnk` 不在仓库里**（`git ls-files` 无 `.lnk`），也不该在——见 §8。
- 全部目标是 `D:\...` 绝对路径；换机后盘符、目录、`D:\净土` 都可能不同。

### 1.4 本机环境对生成方式的硬约束（实测）

| 方案 | 本机实测 | 结论 |
|---|---|---|
| PowerShell `New-Object -ComObject Shell.Application` / `WScript.Shell` | 🔴 被安全策略拦截：「COM object instantiation can run arbitrary code」 | 不能作为生成器主路径 |
| `reg.exe query` 读桌面路径 | 🔴 被程序黑名单拦截 | 改用 Python `winreg` |
| Python `ctypes` 直调 `IShellLinkW` / `IPersistFile` vtable | ✅ 读回 6 个现有 `.lnk` 全部成功 | **采用** |
| 中文路径（`D:\净土\...`、`wcc-启动器.bat`） | ✅ Unicode `LPCWSTR` 读写正常 | 无需额外转码 |

---

## 2. 换机后为什么会「全废」

| # | 失效点 | 后果 | 处理 |
|---|---|---|---|
| 1 | `.lnk` 内写死 `D:\净土\Wcc-deskTop\...` | 双击无反应或指向不存在的路径 | 新机器重新生成（§6） |
| 2 | 桌面物理位置可能不是 `D:\Desktop` | 快捷方式放错地方 | 生成器从注册表读，不写死 |
| 3 | `wc3-forge` / VS Code / WE 装在不同目录 | 外部工具快捷方式失效，或误指向别人的 exe | 环境变量覆盖 + 找不到就 SKIP |
| 4 | 用户级 `WC3FORGE_EXE` 不随 git 走 | `probe` 显示 `(unset)`，forge 工具不可用 | 新机器重新设置，**重新登录**才生效（本机实测） |
| 5 | `node` 不在 PATH | 启动器菜单全废 | `wcc-启动器.bat` ✅ 已改为「优先系统 PATH → 回退 `%USERPROFILE%\.workbuddy\...`」，不写死账号 |
| 6 | 把 `.lnk` 提交进仓库 | 全员 clone 到一堆指向别人电脑的死链 | 🔴 禁止，见 §8 |

> ✅ 第 5 项已在本轮修好：启动器是**唯一可移植的入口**，快捷方式只是它的「门牌」。

---

## 3. 建议的三层入口模型

| 层 | 内容 | 是否随 git | 状态 |
|---|---|---|---|
| **L0 仓库内入口** | `wcc-启动器.bat` 菜单 `[1]` Sidecar / `[2]` check / `[3]` test / `[4]` Desktop / `[5]` harness demo+selftest；`npm test`、`npm run check`、`node harness/bin/wcc-harness.mjs <cmd>` | ✅ 是 | ✅ 已落地 |
| **L1 桌面快捷方式** | 每台机器本地生成的 `.lnk`，只做「打开 L0」的门牌 | 🔴 否（本地产物） | 🟠 建议按 §4 收敛为 2 必需 + 3 可选 |
| **L2 终端 / IDE 入口** | VS Code 任务、shell alias、终端 profile、PATH 注册 | 🟠 可选、本地 | 🟠 不建议优先做：多一套入口就多一套要同步的路径 |

**核心原则**：所有真实逻辑留在 L0；L1 只负责定位，不复制命令、不塞参数、不存凭据。这样升级启动器菜单时，桌面快捷方式一个都不用改。

---

## 4. 建议的快捷方式清单（最小集）

| 名称 | 目标 | 参数 | 工作目录 | 必要性 | 说明 |
|---|---|---|---|---|---|
| `WCC 控制台.lnk` | `<repo>\wcc-启动器.bat` | — | `<repo>` | ✅ 必需 | 一个入口覆盖 5 个操作；图标取 `%SystemRoot%\System32\cmd.exe,0` |
| `WCC 项目目录.lnk` | `<repo>`（文件夹） | — | `<repo>` | ✅ 必需 | 快速打开代码与 `docs/`；图标取 `shell32.dll,3` |
| `WCC VS Code.lnk` | `Code.exe` | `"<repo>"` | `<repo>` | 🟠 可选 | 需 `WCC_VSCODE_EXE` 或标准安装路径 |
| `WCC wc3-forge.lnk` | `wc3-forge.exe` | — | exe 所在目录 | 🟠 可选 | 读 `WC3FORGE_EXE`；**GPL-3.0 二进制不捆绑** |
| `WCC World Editor.lnk` | `worldedit.exe` | — | exe 所在目录 | 🟠 可选 | 仅在目标补丁定下来后才有意义（见 §8） |

**明确不建议**：

- 🔴 不要给每个 npm script / harness 子命令各建一个 `.lnk`。本机桌面已经 12 个快捷方式 + 工具箱 20 个，再拆会膨胀且难以维护。
- 🔴 暂不为交互式 TUI 建独立快捷方式：`tui` 未在真 TTY 验收，目前只有 `tui --static` 非交互降级。
- 🟠 命名建议统一为 `WCC ` 前缀（本机现存的 `Wcc-deskTop 魔兽AI编辑工具.lnk` 属历史遗留，换机时收敛）；可选把输出目录设为 `<桌面>\WCC\` 子文件夹，与 `开源工具箱` 的做法一致。
- 🟠 未安装的工具可沿用工具箱里 `[点击安装] xxx.lnk` 的命名法，指向安装包而不是假装已有。

---

## 5. 生成器：已落地的 `scripts/create-shortcuts.py`

### 5.1 设计约束

| 约束 | 实现方式 |
|---|---|
| 零第三方依赖 | 仅 `ctypes` / `winreg` / `shutil` / `argparse`；Python 3.8+，Windows only |
| 不写死盘符 / 账号 | `--repo` 默认取脚本上级目录；`--desktop` 默认读注册表并 `expandvars` |
| 不依赖被拦的 COM 自动化 | 直接调 `IShellLinkW`(vtable 3/6/7/8/9/10/11/17/20) 与 `IPersistFile`(5 Load / 6 Save) |
| Unicode 路径 | 全程 `LPCWSTR` / `LPWSTR`，实测 `D:\净土\Wcc-deskTop\wcc-启动器.bat` 正常 |
| 不伪造 | 目标不存在 → `SKIP` 并汇总，绝不创建一个死链 |
| 可验收 | 每个 `.lnk` 生成后立刻读回 `target` 做 `normcase` 比对，打印 `read-back OK/MISMATCH` |
| 幂等 | 重复运行安全覆盖，打印 `OVERWRITE`；`--dry-run` 完全不写盘 |
| 图标不依赖外部 exe | 用系统 `%SystemRoot%\System32\cmd.exe` 与 `shell32.dll` |

### 5.2 命令

```bat
:: 1) 先看计划，不写任何文件
python scripts/create-shortcuts.py --dry-run

:: 2) 最小集：2 个必需快捷方式
python scripts/create-shortcuts.py

:: 3) 带外部工具（本机 VS Code / forge 装在非标准路径，需显式给出）
set WCC_VSCODE_EXE=D:\Programs\VSCode\Code.exe
set WC3FORGE_EXE=D:\Programs\wc3-forge\wc3-forge.exe
python scripts/create-shortcuts.py --with-vscode --with-forge

:: 4) 放到子文件夹，避免桌面散落（路径以 --dry-run 打印的 Desktop 为准；本机是 D:\Desktop）
python scripts/create-shortcuts.py --desktop "<你的桌面路径>\WCC"

:: 5) 验收：读回所有 .lnk 的目标 / 工作目录 / 参数
python scripts/create-shortcuts.py --list
```

| 参数 | 作用 |
|---|---|
| `--repo PATH` | 仓库根，默认脚本的上一级目录 |
| `--desktop PATH` | 输出目录，默认当前用户桌面（注册表） |
| `--prefix TEXT` | 名称前缀，默认 `WCC ` |
| `--with-vscode` / `--with-forge` / `--with-war3 EXE` | 追加可选快捷方式 |
| `--dry-run` | 只打印计划，不写盘 |
| `--list` | 读回现有 `.lnk` 并退出 |
| env `WCC_VSCODE_EXE` / `WC3FORGE_EXE` | 覆盖非标准安装路径 |

### 5.3 本机实测结果（真实输出，非预期值）

| 场景 | 结果 |
|---|---|
| `--dry-run`（默认桌面） | ✅ `2 planned, 0 skipped, 0 failed (dry-run, nothing written)` |
| 生成到临时目录，不带环境变量 | ✅ 2 个必需项 `CREATED, read-back OK`；`WCC VS Code` / `WCC wc3-forge` 因目标未找到 `SKIP`，`0 failed` |
| 设 `WCC_VSCODE_EXE` + `WC3FORGE_EXE` 重跑 | ✅ `4 planned, 0 skipped, 0 failed`；两个必需项显示 `OVERWRITE`（幂等），两个可选项 `CREATED` |
| `--list` 读回 | ✅ 4 个 `.lnk` 的 `target` / `workdir` / `args` 与计划一致，中文路径无损 |

> 🔴 上述生成全部落在 `C:\Users\Administrator\AppData\Local\Temp\wcc-lnk-test\`，**没有改动本机桌面、没有改注册表、没有把任何 `.lnk` 放进仓库**。

---

## 6. 新机器标准流程（建议顺序）

1. `git clone` → `npm install` → 跑完 `NEW-MACHINE-SETUP.md` §2 的四条回归基线。
2. 确认 `node -v` 可用（启动器依赖它；找不到会给出明确报错而不是黑屏）。
3. `python scripts/create-shortcuts.py --dry-run` —— 核对打印出来的仓库根与桌面路径。
4. 如需外部工具，先装好再设 `WCC_VSCODE_EXE` / `WC3FORGE_EXE`；**用户级环境变量要重新登录才生效**。
5. `python scripts/create-shortcuts.py --desktop "<桌面>\WCC" --with-vscode --with-forge`（按需加 `--with-war3`）。
6. `python scripts/create-shortcuts.py --desktop "<桌面>\WCC" --list` —— 逐个核对目标存在。
7. 双击 `WCC 控制台.lnk`，依次跑菜单 `[2]` check、`[3]` test、`[5]` harness demo+selftest。
8. 在 `NEW-MACHINE-SETUP.md` §8 的勾选项里补一条「桌面入口已重建并读回校验」。

> 🟠 本机尚未在新机器执行过此流程；步骤 1 的 clone 现已可走私有 Gitee 仓库（需凭据），或直接用离线归档恢复，见 §9 与 [NEW-MACHINE-SETUP.md](NEW-MACHINE-SETUP.md) §1。

---

## 7. 验证清单

- [ ] `python scripts/create-shortcuts.py --dry-run` 打印的 repo / desktop 与预期一致
- [ ] 必需 2 个 `.lnk` 生成，且 `--list` 读回 `target` 均指向**本机真实存在**的路径
- [ ] 可选工具缺失时是 `SKIP`（而不是生成空目标快捷方式）
- [ ] 重复运行显示 `OVERWRITE`，不产生重名副本
- [ ] 双击 `WCC 控制台.lnk` 能出现 6 行菜单，`[0]` 能正常退出
- [ ] 桌面 / 注册表 / 仓库内都没有新增被提交的 `.lnk`
- [ ] `git status` 中不含任何快捷方式二进制或本机绝对路径

---

## 8. 红线与风险

| 级别 | 条目 |
|---|---|
| 🔴 | **不要把 `.lnk` 提交进仓库**：内含本机绝对路径、二进制 diff 无意义、其他维护者 clone 到的是死链。✅ 本轮已在 `.gitignore` 加 `*.lnk`，把这条约定变成硬约束（此前仅靠「不主动 add」保证）。 |
| 🔴 | **不要写死盘符 / 用户账号 / 安装目录**；历史教训是启动器曾写死 `C:\Users\Administrator\.workbuddy\...\node.exe`，本轮已改为便携版。 |
| 🔴 | **不要在快捷方式参数里放 API key / token**。模型凭据走 `WCC_MODEL_*` 环境变量或 `.wcc/`（已被 `.gitignore` 排除）。 |
| 🔴 | **不要把「改注册表桌面路径」当成部署步骤**。本机改为 `D:\Desktop` 是当初整理电脑的个体行为，新机器用系统默认即可。 |
| 🔴 | **不捆绑 `wc3-forge.exe`**（GPL-3.0）到 MIT 仓库；快捷方式只指向外部安装，且缺失时跳过。 |
| 🟠 | 用户级 `WC3FORGE_EXE` 需重新登录 / 重启资源管理器才在当前 shell 可见；本机多次实测读不到，脚本因此跳过是可接受行为。 |
| 🟠 | `--with-war3` 只有在目标补丁决策后才该启用：本机是 **1.26.0.6401（只跑 JASS）**，而仓库资产是 Lua 1.31+，见 `MAP-COMPILE-PIPELINE.md` §5。 |
| 🟠 | 图标优先用系统 DLL；指向已卸载 exe 的图标会显示成白板。 |
| 🟠 | `IShellLinkW` vtable 直调属于系统级 API，Windows 大版本更新后应重跑 `--dry-run` + `--list` 自检；脚本已把每个 HRESULT 转成可读报错，不会静默失败。 |

---

## 9. 本轮状态与未完成项

| 项 | 状态 |
|---|---|
| 核查本机桌面、注册表、6 个现有 `.lnk` 目标 | ✅ 实测 |
| 新增 `scripts/create-shortcuts.py`（零依赖、Unicode、读回校验、幂等、SKIP 不伪造） | ✅ 已落地并实测 |
| 新增本文、README 索引、`NEW-MACHINE-SETUP.md` 过期声明校正、`.gitignore` 加 `*.lnk` | ✅ 本轮 |
| 在**新机器**实际跑一遍 §6 流程 | 🔴 未做（换机尚未发生） |
| 改动本机桌面 / 注册表 / 生成到真实桌面 | 🔴 未做 |
| 把 `.lnk` 或任何本机绝对路径提交进仓库 | 🔴 未做，且不建议 |
| 云端同步 | ✅ 2026-11-10 已把 Gitee 侧 7 个提交推送到 **Gitee 私有仓库** `wei-kaijie/Wcc-deskTop`（项目为半成品，刻意不对外公开）；✅ 当日晚间完成三处合并同步，**GitHub 官方仓库已与 Gitee、本地 `main` 对齐**（`d8ccdfb`，后续以 `git log -1` 为准） |

---

## 10. 关联文档

- [NEW-MACHINE-SETUP.md](NEW-MACHINE-SETUP.md) — clone → 依赖 → 回归；不入库的配置与必须带走的数据
- [MAP-COMPILE-PIPELINE.md](MAP-COMPILE-PIPELINE.md) — 目标补丁（1.26 / 1.31+ / 双轨）决策，决定 `--with-war3` 是否该启用
- [HARNESS-IMPLEMENTATION.md](HARNESS-IMPLEMENTATION.md) — 启动器菜单 `[5]` 背后的 harness CLI 与脚本 manifest
- `wcc-启动器.bat` — L0 唯一可移植入口
- `scripts/create-shortcuts.py` — 本文建议的生成器实现
