"""Start Vite only — no Rust build. For UI/CSS work. Double-click to run."""
import subprocess, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.exit(subprocess.run([sys.executable, "run.py", "ui"]).returncode)
except KeyboardInterrupt:
    pass
