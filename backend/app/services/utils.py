import os
import subprocess
import shutil
import logging

# Cache original subprocess functions before any monkey-patching occurs
_orig_run = subprocess.run
_orig_check_output = subprocess.check_output

logger = logging.getLogger("device_manager_utils")

# Global flag to track whether nsenter is supported and functional
_use_nsenter = None

def check_nsenter_support() -> bool:
    global _use_nsenter
    if _use_nsenter is not None:
        return _use_nsenter

    _use_nsenter = False
    # Check if we are running in a Docker container and nsenter is available
    if os.path.exists("/.dockerenv") and shutil.which("nsenter") is not None:
        try:
            # Test if we can access the host mount and namespaces using nsenter.
            # We run a simple check command ('true') on the host namespace (PID 1).
            res = _orig_run(
                ["nsenter", "-t", "1", "-m", "-u", "-n", "-i", "--", "true"],
                capture_output=True,
                text=True,
                timeout=2
            )
            if res.returncode == 0:
                _use_nsenter = True
                logger.info("Docker container supports nsenter. System commands will run on the host namespace.")
            else:
                logger.warning(f"nsenter failed (code {res.returncode}): {res.stderr.strip()}. Running commands inside container instead.")
        except Exception as e:
            logger.warning(f"Failed to check nsenter support: {str(e)}. Running commands inside container instead.")
    return _use_nsenter

def run_host_cmd(cmd: list, **kwargs) -> subprocess.CompletedProcess:
    # Set default values for capture_output and text if not specified
    if "capture_output" not in kwargs and "stdout" not in kwargs and "stderr" not in kwargs:
        kwargs["capture_output"] = True
    if "text" not in kwargs:
        kwargs["text"] = True

    if check_nsenter_support():
        clean_cmd = list(cmd)
        if clean_cmd and clean_cmd[0] == "sudo":
            clean_cmd.pop(0)
        wrapped_cmd = ["nsenter", "-t", "1", "-m", "-u", "-n", "-i", "--"] + clean_cmd
        return _orig_run(wrapped_cmd, **kwargs)
    else:
        return _orig_run(cmd, **kwargs)

def check_host_output(cmd: list, **kwargs) -> str:
    if "text" not in kwargs:
        kwargs["text"] = True

    if check_nsenter_support():
        clean_cmd = list(cmd)
        if clean_cmd and clean_cmd[0] == "sudo":
            clean_cmd.pop(0)
        wrapped_cmd = ["nsenter", "-t", "1", "-m", "-u", "-n", "-i", "--"] + clean_cmd
        return _orig_check_output(wrapped_cmd, **kwargs)
    else:
        return _orig_check_output(cmd, **kwargs)
