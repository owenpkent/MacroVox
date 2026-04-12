"""Start Tauri dev with debug logging + DevTools. Double-click to run."""
import subprocess, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.exit(subprocess.run(f"{sys.executable} run.py debug", shell=True).returncode)
except KeyboardInterrupt:
    pass
