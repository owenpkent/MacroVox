#!/usr/bin/env python3
"""
MacroVox local dev runner.

Usage:
    python run.py           # build main + start Vite + launch Electron
    python run.py build     # production build
    python run.py test      # run tests
    python run.py install   # npm install
"""

import subprocess
import sys
import os
import time
import signal
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
VITE_URL = "http://localhost:5173/dictation.html"


def ensure_tray_icon():
    """Generate a minimal 16x16 white tray icon PNG if it doesn't exist."""
    import struct
    import zlib
    icon_path = os.path.join(ROOT, 'resources', 'icons', 'tray-icon.png')
    if os.path.exists(icon_path):
        return
    os.makedirs(os.path.dirname(icon_path), exist_ok=True)

    def chunk(name: bytes, data: bytes) -> bytes:
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    sig  = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', 16, 16, 8, 2, 0, 0, 0))
    raw  = b''.join(b'\x00' + b'\xff\xff\xff' * 16 for _ in range(16))
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    with open(icon_path, 'wb') as f:
        f.write(sig + ihdr + idat + iend)
    print(f'  Created dev tray icon: resources/icons/tray-icon.png')


def npm(args: str) -> int:
    """Run an npm command string via shell (handles npm.cmd on Windows)."""
    cmd = f"npm {args}"
    print(f"  > {cmd}")
    result = subprocess.run(cmd, cwd=ROOT, shell=True)
    return result.returncode


def npm_bg(args: str, env: dict | None = None) -> subprocess.Popen:
    """Start an npm command in the background."""
    import os as _os
    cmd = f"npm {args}"
    print(f"  > {cmd}  (background)")
    merged_env = _os.environ.copy()
    if env:
        merged_env.update(env)
    return subprocess.Popen(cmd, cwd=ROOT, shell=True, env=merged_env)


def shell_output(cmd: str) -> str:
    return subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.STDOUT).strip()


def check_prerequisites():
    errors = []

    try:
        out = shell_output("node --version")
        major = int(out.lstrip("v").split(".")[0])
        if major < 20:
            errors.append(f"Node.js 20+ required (found {out})")
        else:
            print(f"  Node.js {out}")
    except subprocess.CalledProcessError:
        errors.append("Node.js not found — install from https://nodejs.org")

    try:
        out = shell_output("npm --version")
        print(f"  npm {out}")
    except subprocess.CalledProcessError:
        errors.append("npm not found")

    try:
        shell_output("ffmpeg -version")
        print("  ffmpeg ✓")
    except subprocess.CalledProcessError:
        print("  ffmpeg ✓")  # exits non-zero but is present
    except FileNotFoundError:
        errors.append("ffmpeg not found — run: winget install ffmpeg")

    if not os.path.isdir(os.path.join(ROOT, "node_modules")):
        errors.append("node_modules missing — run: python run.py install")

    return errors


def wait_for_vite(timeout=30):
    """Poll until Vite dev server responds."""
    print(f"  Waiting for Vite at {VITE_URL} ", end="", flush=True)
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(VITE_URL, timeout=1)
            print(" ready!")
            return True
        except urllib.error.HTTPError:
            # Any HTTP response means Vite is up
            print(" ready!")
            return True
        except Exception:
            print(".", end="", flush=True)
            time.sleep(1)
    print(" timed out!")
    return False


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "dev"

    print("\nMacroVox — Local Dev Runner")
    print("=" * 40)

    if mode == "install":
        print("\nInstalling dependencies...")
        sys.exit(npm("install"))

    if mode == "test":
        print("\nRunning tests...")
        sys.exit(npm("test"))

    if mode == "build":
        print("\nBuilding for production...")
        sys.exit(npm("run build"))

    # Default: dev
    print("\nChecking prerequisites...")
    errors = check_prerequisites()
    if errors:
        print("\n[!] Prerequisites not met:")
        for e in errors:
            print(f"    - {e}")
        sys.exit(1)

    print("\nStep 1: Building main process...")
    code = npm("run build:main")
    if code != 0:
        print("[!] Main process build failed.")
        sys.exit(code)

    print("\nStep 2: Starting Vite dev server...")
    vite_proc = npm_bg("run dev:renderer")

    if not wait_for_vite():
        vite_proc.terminate()
        print("[!] Vite did not start. Check for port conflicts.")
        sys.exit(1)

    print("\nStep 3: Launching Electron...")
    ensure_tray_icon()
    # Kill any lingering Electron from a previous dev session (single-instance lock)
    subprocess.run("taskkill /F /IM electron.exe /T", shell=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.5)
    electron_proc = npm_bg("run start", env={"ELECTRON_DEV": "true"})

    print("\n  MacroVox is running. Press Ctrl+C to stop.\n")

    procs = [vite_proc, electron_proc]

    def shutdown(sig=None, frame=None):
        print("\nShutting down...")
        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Wait — if Electron exits, shut everything down
    electron_proc.wait()
    shutdown()


if __name__ == "__main__":
    main()
