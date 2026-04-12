"""Start Vite only — no Rust build. For UI/CSS work. Double-click to run."""
import subprocess, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.exit(subprocess.run(f"{sys.executable} run.py ui", shell=True).returncode)
except KeyboardInterrupt:
    pass
