"""Start Tauri dev with debug logging + DevTools. Double-click to run."""
import subprocess, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.exit(subprocess.run([sys.executable, "run.py", "debug"]).returncode)
except KeyboardInterrupt:
    pass
