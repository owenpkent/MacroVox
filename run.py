"""
MacroVox dev launcher.

Usage:
    python run.py            # start Tauri dev (Vite + Rust, first run compiles)
    python run.py install    # npm install only
    python run.py test       # run JS tests (vitest)
    python run.py test:rust  # run Rust unit tests
    python run.py build      # production build (npm run build:renderer)
"""

import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.abspath(__file__))


def run(cmd: str, **kwargs) -> int:
    print(f"  > {cmd}")
    return subprocess.run(cmd, cwd=ROOT, shell=True, **kwargs).returncode


def check(cmd: str, label: str) -> bool:
    try:
        out = subprocess.check_output(cmd, shell=True, text=True,
                                      stderr=subprocess.STDOUT).strip()
        first_line = out.splitlines()[0] if out else "(ok)"
        print(f"  [ok] {label}: {first_line}")
        return True
    except subprocess.CalledProcessError:
        print(f"  [missing] {label}")
        return False


def check_prerequisites() -> bool:
    print("Checking prerequisites...")
    node = check("node --version", "Node.js")
    npm  = check("npm --version",  "npm")
    rust = check("rustc --version", "Rust")
    cgo  = check("cargo --version", "Cargo")

    ok = True
    if not (node and npm):
        print("\n  Install Node.js 20+ from https://nodejs.org/")
        ok = False
    if not (rust and cgo):
        print("\n  Install Rust from https://rustup.rs/")
        ok = False
    return ok


def ensure_node_modules():
    if not os.path.isdir(os.path.join(ROOT, "node_modules")):
        print("\nnode_modules missing — running npm install...")
        code = run("npm install")
        if code != 0:
            sys.exit("npm install failed.")
    else:
        print("  [ok] node_modules")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "dev"

    print("\nMacroVox dev launcher")
    print("=" * 40)

    if mode == "install":
        sys.exit(run("npm install"))

    if mode == "test":
        sys.exit(run("npm test"))

    if mode == "test:rust":
        sys.exit(run("cargo test --manifest-path src-tauri/Cargo.toml"))

    if mode == "build":
        sys.exit(run("npm run build:renderer"))

    # Default: dev
    print()
    if not check_prerequisites():
        sys.exit(1)

    ensure_node_modules()

    print("\nRunning npm install to sync dependencies...")
    code = run("npm install")
    if code != 0:
        sys.exit("npm install failed.")

    print("\nStarting Tauri dev environment...")
    print("  Vite renderer  → http://localhost:5173")
    print("  Tauri window   → opens automatically")
    print("  (First run compiles Rust — takes a few minutes)\n")

    try:
        code = run("npx tauri dev")
        sys.exit(code)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
