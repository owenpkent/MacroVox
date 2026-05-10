"""Start Netlify dev (local API functions + Vite). Double-click to run."""
import subprocess, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.exit(subprocess.run([sys.executable, "run.py", "functions"]).returncode)
except KeyboardInterrupt:
    pass
