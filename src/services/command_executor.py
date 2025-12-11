"""
MacroVox Command Executor
Real terminal emulation using pywinpty for Windows
"""

import os
import threading
from typing import Callable, Optional

from PySide6.QtCore import QObject, Signal

try:
    from winpty import PtyProcess
    HAS_WINPTY = True
except ImportError:
    HAS_WINPTY = False


class CommandExecutor(QObject):
    """
    Executes shell commands in a real PTY session.
    
    Provides a persistent shell session where commands can be run
    and working directory changes persist across commands.
    """
    
    output_received = Signal(str)  # Emits terminal output
    error_occurred = Signal(str)   # Emits error messages
    
    def __init__(self, cwd: Optional[str] = None, parent=None):
        super().__init__(parent)
        self._cwd = cwd or os.getcwd()
        self._pty: Optional[PtyProcess] = None
        self._reader_thread: Optional[threading.Thread] = None
        self._running = False
        
    @property
    def is_running(self) -> bool:
        """Check if the PTY session is active."""
        return self._running and self._pty is not None
    
    @property
    def working_directory(self) -> str:
        """Get the initial working directory."""
        return self._cwd
        
    def start(self) -> bool:
        """
        Start the PTY session.
        
        Returns:
            True if started successfully, False otherwise.
        """
        if not HAS_WINPTY:
            self.error_occurred.emit("pywinpty not installed. Run: pip install pywinpty")
            return False
            
        if self._running:
            return True
            
        try:
            # Start cmd.exe in the specified directory
            self._pty = PtyProcess.spawn(
                "cmd.exe",
                cwd=self._cwd,
                dimensions=(24, 120)  # rows, cols
            )
            self._running = True
            
            # Start reader thread
            self._reader_thread = threading.Thread(
                target=self._read_output,
                daemon=True
            )
            self._reader_thread.start()
            
            return True
            
        except Exception as e:
            self.error_occurred.emit(f"Failed to start terminal: {e}")
            return False
    
    def stop(self):
        """Stop the PTY session."""
        self._running = False
        
        if self._pty:
            try:
                self._pty.terminate()
            except Exception:
                pass
            self._pty = None
            
    def write(self, data: str):
        """
        Write data to the PTY (send command or input).
        
        Args:
            data: The string to write (include \\r\\n for Enter)
        """
        if self._pty and self._running:
            try:
                self._pty.write(data)
            except Exception as e:
                self.error_occurred.emit(f"Write error: {e}")
                
    def send_command(self, command: str):
        """
        Send a command to the terminal.
        
        Args:
            command: The command to execute (Enter is added automatically)
        """
        self.write(command + "\r\n")
        
    def send_interrupt(self):
        """Send Ctrl+C to the terminal."""
        self.write("\x03")
        
    def _read_output(self):
        """Background thread that reads PTY output."""
        while self._running and self._pty:
            try:
                # Read available output (non-blocking with timeout)
                if self._pty.isalive():
                    data = self._pty.read(4096)
                    if data:
                        self.output_received.emit(data)
                else:
                    # Process ended
                    self._running = False
                    break
            except EOFError:
                self._running = False
                break
            except Exception as e:
                if self._running:  # Only emit if we didn't intentionally stop
                    self.error_occurred.emit(f"Read error: {e}")
                break
                
    def change_directory(self, path: str):
        """
        Change the working directory.
        
        Args:
            path: Directory path (absolute or relative)
        """
        self.send_command(f"cd /d {path}")
        
    def __del__(self):
        """Cleanup on destruction."""
        self.stop()
