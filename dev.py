"""Start Tauri dev (Vite + Rust). Double-click to run."""
import subprocess, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.exit(subprocess.run([sys.executable, "run.py", "dev"]).returncode)
except KeyboardInterrupt:
    pass
