"""Start Tauri dev (Vite + Rust). Double-click to run."""
import subprocess, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.exit(subprocess.run(f"{sys.executable} run.py dev", shell=True).returncode)
except KeyboardInterrupt:
    pass
