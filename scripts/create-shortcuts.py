#!/usr/bin/env python3
"""Create WCC desktop shortcuts on a fresh machine.

Zero third-party dependencies, Windows only. Uses IShellLinkW + IPersistFile
through ctypes (COM vtable) instead of WScript.Shell, because COM automation
can be blocked by security policy on some WorkBuddy setups.

Design rules (see docs/DEPLOYMENT-SHORTCUTS.md):
  * Never hard-code a drive letter, user account name or install directory.
  * The .lnk files are machine-local artifacts and are NEVER committed.
  * Missing optional tools are reported and skipped, never faked.
  * Every created shortcut is read back and verified.

Usage:
    python scripts/create-shortcuts.py --dry-run
    python scripts/create-shortcuts.py
    python scripts/create-shortcuts.py --list
    python scripts/create-shortcuts.py --desktop "D:\\Desktop\\WCC" --with-forge --with-vscode
"""

from __future__ import annotations

import argparse
import ctypes
import os
import shutil
import sys
import uuid
from ctypes import wintypes

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HRESULT = ctypes.c_long


class GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", ctypes.c_ulong),
        ("Data2", ctypes.c_ushort),
        ("Data3", ctypes.c_ushort),
        ("Data4", ctypes.c_ubyte * 8),
    ]


def _guid(text: str) -> GUID:
    u = uuid.UUID(text)
    b = u.bytes_le
    return GUID(u.time_low, u.time_mid, u.time_hi_version,
                (ctypes.c_ubyte * 8)(*b[8:16]))


CLSID_SHELL_LINK = _guid("{00021401-0000-0000-C000-000000000046}")
IID_ISHELL_LINK_W = _guid("{000214F9-0000-0000-C000-000000000046}")
IID_IPERSIST_FILE = _guid("{0000010B-0000-0000-C000-000000000046}")

_OLE32 = None
try:
    _OLE32 = ctypes.windll.ole32
    _OLE32.CoCreateInstance.argtypes = [
        ctypes.POINTER(GUID), ctypes.c_void_p, wintypes.DWORD,
        ctypes.POINTER(GUID), ctypes.POINTER(ctypes.c_void_p),
    ]
    _OLE32.CoCreateInstance.restype = HRESULT
    _OLE32.CoInitializeEx.argtypes = [ctypes.c_void_p, wintypes.DWORD]
    _OLE32.CoInitializeEx.restype = HRESULT
except AttributeError:
    pass  # non-Windows: --dry-run / --list still work


# IShellLinkW vtable: 0 QI, 1 AddRef, 2 Release, 3 GetPath, 6 GetDescription,
# 7 SetDescription, 8 GetWorkingDirectory, 9 SetWorkingDirectory,
# 10 GetArguments, 11 SetArguments, 17 SetIconLocation, 20 SetPath
# IPersistFile vtable: 0 QI, 5 Load, 6 Save
_FN_QI = ctypes.WINFUNCTYPE(HRESULT, ctypes.c_void_p, ctypes.POINTER(GUID),
                            ctypes.POINTER(ctypes.c_void_p)) if _OLE32 else None
_FN_SET = ctypes.WINFUNCTYPE(HRESULT, ctypes.c_void_p, wintypes.LPCWSTR) if _OLE32 else None
_FN_SET_ICON = ctypes.WINFUNCTYPE(HRESULT, ctypes.c_void_p, wintypes.LPCWSTR,
                                  ctypes.c_int) if _OLE32 else None
_FN_GET = ctypes.WINFUNCTYPE(HRESULT, ctypes.c_void_p, wintypes.LPWSTR,
                             ctypes.c_int, ctypes.c_void_p, wintypes.DWORD) if _OLE32 else None
_FN_LOAD = ctypes.WINFUNCTYPE(HRESULT, ctypes.c_void_p, wintypes.LPCWSTR,
                              wintypes.DWORD) if _OLE32 else None
_FN_SAVE = ctypes.WINFUNCTYPE(HRESULT, ctypes.c_void_p, wintypes.LPCWSTR,
                              ctypes.c_int) if _OLE32 else None
_FN_RELEASE = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p) if _OLE32 else None


def _check_hr(hr, what: str):
    code = ctypes.c_long(hr).value
    if code < 0:
        raise OSError("%s failed, HRESULT=0x%08X" % (what, code & 0xFFFFFFFF))


def _vtable(ptr, index: int):
    return ctypes.cast(ptr, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents[index]


def _new_shell_link():
    if _OLE32 is None:
        raise OSError("Windows COM (ole32) is unavailable on this platform")
    _OLE32.CoInitializeEx(None, 2)  # COINIT_APARTMENTTHREADED
    p = ctypes.c_void_p()
    _check_hr(_OLE32.CoCreateInstance(
        ctypes.byref(CLSID_SHELL_LINK), None, 1,  # CLSCTX_INPROC_SERVER
        ctypes.byref(IID_ISHELL_LINK_W), ctypes.byref(p)), "CoCreateInstance")
    return p


def _query_persist_file(p):
    pf = ctypes.c_void_p()
    _check_hr(_FN_QI(_vtable(p, 0))(p, ctypes.byref(IID_IPERSIST_FILE),
                                    ctypes.byref(pf)), "QueryInterface(IPersistFile)")
    return pf


def _release(*ptrs):
    for p in ptrs:
        if p:
            try:
                _FN_RELEASE(_vtable(p, 2))(p)
            except Exception:
                pass


def create_shortcut(lnk_path: str, target: str, *, workdir: str = "",
                    arguments: str = "", description: str = "", icon: str = "") -> None:
    """Create (or overwrite) one Unicode .lnk file."""
    p = _new_shell_link()
    pf = None
    try:
        _check_hr(_FN_SET(_vtable(p, 20))(p, target), "SetPath")
        if workdir:
            _check_hr(_FN_SET(_vtable(p, 9))(p, workdir), "SetWorkingDirectory")
        if arguments:
            _check_hr(_FN_SET(_vtable(p, 11))(p, arguments), "SetArguments")
        if description:
            _check_hr(_FN_SET(_vtable(p, 7))(p, description), "SetDescription")
        if icon:
            icon_path, _, icon_index = icon.rpartition(",")
            if not icon_path:
                icon_path, icon_index = icon, "0"
            try:
                idx = int(icon_index)
            except ValueError:
                idx = 0
            _check_hr(_FN_SET_ICON(_vtable(p, 17))(p, icon_path, idx), "SetIconLocation")
        pf = _query_persist_file(p)
        os.makedirs(os.path.dirname(lnk_path), exist_ok=True)
        _check_hr(_FN_SAVE(_vtable(pf, 6))(pf, lnk_path, 1), "IPersistFile::Save")
    finally:
        _release(pf, p)


def read_shortcut(lnk_path: str) -> dict:
    """Read back the fields we care about; used for verification and --list."""
    p = _new_shell_link()
    pf = None
    try:
        pf = _query_persist_file(p)
        _check_hr(_FN_LOAD(_vtable(pf, 5))(pf, lnk_path, 0), "IPersistFile::Load")
        out = {}
        for name, idx in (("target", 3), ("description", 6),
                          ("workdir", 8), ("arguments", 10)):
            buf = ctypes.create_unicode_buffer(2048)
            hr = _FN_GET(_vtable(p, idx))(p, buf, 2048, None, 0)
            out[name] = buf.value if hr >= 0 else "<read error>"
        return out
    finally:
        _release(pf, p)


def default_desktop() -> str:
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders")
        value, _ = winreg.QueryValueEx(key, "Desktop")
        return os.path.expandvars(value)
    except Exception:
        return os.path.join(os.path.expanduser("~"), "Desktop")


def find_vscode() -> str:
    override = os.environ.get("WCC_VSCODE_EXE", "")
    if override and os.path.isfile(override):
        return override
    candidates = [
        shutil.which("code.cmd") or "",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft VS Code\Code.exe"),
    ]
    for c in candidates:
        if c and os.path.isfile(c) and c.lower().endswith("code.exe"):
            return c
    return ""


def find_forge() -> str:
    override = os.environ.get("WC3FORGE_EXE", "")
    if override and os.path.isfile(override):
        return override
    found = shutil.which("wc3-forge") or ""
    return found if found and os.path.isfile(found) else ""


def build_plan(repo: str, desktop: str, opts) -> list:
    """Return list of dicts: name, target, workdir, arguments, description, icon, note."""
    sysroot = os.path.expandvars(r"%SystemRoot%\System32")
    cmd_icon = os.path.join(sysroot, "cmd.exe") + ",0"
    folder_icon = os.path.join(sysroot, "shell32.dll") + ",3"
    prefix = opts.prefix
    plans = []

    launcher = os.path.join(repo, "wcc-启动器.bat")
    plans.append({
        "name": prefix + "控制台.lnk",
        "target": launcher,
        "workdir": repo,
        "arguments": "",
        "description": "WCC 启动控制台 (Sidecar / Check / Test / Desktop / Harness demo)",
        "icon": cmd_icon,
        "note": "必需：仓库内入口，菜单覆盖日常全部操作",
        "required": True,
    })
    plans.append({
        "name": prefix + "项目目录.lnk",
        "target": repo,
        "workdir": repo,
        "arguments": "",
        "description": "Warcraft Campaign Craft 仓库根目录",
        "icon": folder_icon,
        "note": "必需：直接打开代码与 docs/",
        "required": True,
    })

    if opts.with_vscode:
        exe = find_vscode()
        plans.append({
            "name": prefix + "VS Code.lnk",
            "target": exe,
            "workdir": repo,
            "arguments": '"%s"' % repo,
            "description": "用 VS Code 打开 WCC 仓库",
            "icon": (exe + ",0") if exe else folder_icon,
            "note": "可选：未找到 Code.exe 时跳过",
            "required": False,
        })

    if opts.with_forge:
        exe = find_forge()
        plans.append({
            "name": prefix + "wc3-forge.lnk",
            "target": exe,
            "workdir": os.path.dirname(exe) if exe else repo,
            "arguments": "",
            "description": "wc3-forge 地图编辑器 (GPL-3.0，外部安装，不随仓库分发)",
            "icon": (exe + ",0") if exe else folder_icon,
            "note": "可选：读 WC3FORGE_EXE；GPL 二进制不捆绑",
            "required": False,
        })

    if opts.with_war3:
        exe = opts.with_war3
        plans.append({
            "name": prefix + "World Editor.lnk",
            "target": exe,
            "workdir": os.path.dirname(exe),
            "arguments": "",
            "description": "原版世界编辑器 (Save 才会编译 GUI 触发器)",
            "icon": exe + ",0",
            "note": "可选：仅在目标补丁确定后需要",
            "required": False,
        })
    return plans


def cmd_list(desktop: str) -> int:
    import glob
    files = sorted(glob.glob(os.path.join(desktop, "*.lnk")))
    if not files:
        print("(no .lnk found in %s)" % desktop)
        return 0
    print("Shortcuts in %s: %d" % (desktop, len(files)))
    for f in files:
        try:
            d = read_shortcut(f)
            print("  %-34s -> %s" % (os.path.basename(f), d["target"]))
            if d["workdir"]:
                print("      workdir: %s" % d["workdir"])
            if d["arguments"]:
                print("      args   : %s" % d["arguments"])
        except Exception as e:
            print("  %-34s -> <unreadable: %s>" % (os.path.basename(f), e))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Create portable WCC desktop shortcuts")
    ap.add_argument("--repo", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    help="WCC repository root (default: parent of scripts/)")
    ap.add_argument("--desktop", default=default_desktop(),
                    help="shortcut output folder (default: current user's Desktop from registry)")
    ap.add_argument("--prefix", default="WCC ", help="shortcut name prefix")
    ap.add_argument("--with-vscode", action="store_true", help="also create a VS Code shortcut")
    ap.add_argument("--with-forge", action="store_true", help="also create a wc3-forge shortcut")
    ap.add_argument("--with-war3", default="", metavar="WORLDEDIT_EXE",
                    help="also create a World Editor shortcut pointing to this exe")
    ap.add_argument("--dry-run", action="store_true", help="print plan only, write nothing")
    ap.add_argument("--list", action="store_true", help="read back existing shortcuts and exit")
    opts = ap.parse_args()

    repo = os.path.abspath(opts.repo)
    desktop = os.path.abspath(opts.desktop)
    if opts.list:
        return cmd_list(desktop)

    print("Repository : %s" % repo)
    print("Desktop    : %s" % desktop)
    if not os.path.isdir(repo):
        print("[ERROR] repository not found: %s" % repo)
        return 2
    launcher = os.path.join(repo, "wcc-启动器.bat")
    if not os.path.isfile(launcher):
        print("[ERROR] launcher missing: %s" % launcher)
        print("        Shortcuts would point at a dead target. Aborting.")
        return 2
    if not shutil.which("node"):
        print("[WARN] node is not on PATH. The launcher will fall back to its built-in")
        print("       node detection; install Node.js 20+ before relying on these shortcuts.")

    plans = build_plan(repo, desktop, opts)
    print("")
    skipped, failures = [], []
    for item in plans:
        dest = os.path.join(desktop, item["name"])
        ok_target = bool(item["target"]) and (os.path.isfile(item["target"]) or os.path.isdir(item["target"]))
        print("[%s] %s" % ("PLAN" if opts.dry_run else "MAKE", item["name"]))
        print("      target : %s" % (item["target"] or "(not found)"))
        print("      workdir: %s" % (item["workdir"] or "-"))
        if item["arguments"]:
            print("      args   : %s" % item["arguments"])
        print("      why    : %s" % item["note"])
        if not ok_target:
            skipped.append(item["name"])
            print("      result : SKIP (target not found; no fake shortcut created)")
            continue
        if opts.dry_run:
            continue
        try:
            existed = os.path.isfile(dest)
            create_shortcut(dest, item["target"], workdir=item["workdir"],
                            arguments=item["arguments"],
                            description=item["description"], icon=item["icon"])
            back = read_shortcut(dest)
            same = os.path.normcase(os.path.abspath(back["target"])) == \
                   os.path.normcase(os.path.abspath(item["target"]))
            print("      result : %s, read-back %s%s" %
                  ("OVERWRITE" if existed else "CREATED",
                   "OK" if same else "MISMATCH", "" if same else " -> " + back["target"]))
            if not same:
                failures.append(item["name"])
        except Exception as e:
            print("      result : FAILED %s" % e)
            failures.append(item["name"])

    print("")
    print("Summary: %d planned, %d skipped, %d failed%s" %
          (len(plans), len(skipped), len(failures), " (dry-run, nothing written)" if opts.dry_run else ""))
    if skipped:
        print("  skipped: " + ", ".join(skipped))
    if failures:
        print("  failed : " + ", ".join(failures))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
