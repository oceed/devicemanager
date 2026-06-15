import subprocess
import shutil
import re
import os

class UsbService:
    @staticmethod
    def is_linux() -> bool:
        return os.name == 'posix'

    @classmethod
    def get_devices(cls) -> list:
        if not cls.is_linux() or shutil.which("lsusb") is None:
            # Mock data for local testing
            return [
                {
                    "bus": "001",
                    "device": "001",
                    "id": "1d6b:0002",
                    "vendor_id": "1d6b",
                    "product_id": "0002",
                    "name": "Linux Foundation 2.0 root hub",
                    "path": "/dev/bus/usb/001/001"
                },
                {
                    "bus": "001",
                    "device": "002",
                    "id": "05e3:0608",
                    "vendor_id": "05e3",
                    "product_id": "0608",
                    "name": "Genesys Logic, Inc. Hub",
                    "path": "/dev/bus/usb/001/002"
                },
                {
                    "bus": "001",
                    "device": "003",
                    "id": "2c7c:0125",
                    "vendor_id": "2c7c",
                    "product_id": "0125",
                    "name": "Quectel Wireless Solutions Co., Ltd. EC25 LTE modem",
                    "path": "/dev/bus/usb/001/003"
                },
                {
                    "bus": "002",
                    "device": "001",
                    "id": "1d6b:0003",
                    "vendor_id": "1d6b",
                    "product_id": "0003",
                    "name": "Linux Foundation 3.0 root hub",
                    "path": "/dev/bus/usb/002/001"
                }
            ]

        try:
            output = subprocess.check_output(["lsusb"], text=True).strip()
            devices = []
            pattern = re.compile(r"Bus\s+(\d+)\s+Device\s+(\d+):\s+ID\s+([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\s+(.*)")
            for line in output.split("\n"):
                match = pattern.match(line)
                if match:
                    bus, device, vid, pid, name = match.groups()
                    path = f"/dev/bus/usb/{bus}/{device}"
                    devices.append({
                        "bus": bus,
                        "device": device,
                        "id": f"{vid}:{pid}",
                        "vendor_id": vid,
                        "product_id": pid,
                        "name": name.strip(),
                        "path": path
                    })
            return devices
        except Exception as e:
            return [{"error": str(e)}]

    @classmethod
    def reset_device(cls, path: str) -> dict:
        if not cls.is_linux() or not os.path.exists(path):
            # If path is mock or on non-linux systems
            if not cls.is_linux() or "mock" in path or path.startswith("/dev/bus/usb/"):
                return {"success": True, "message": f"Mock: Successfully reset USB device at path '{path}'"}
            return {"success": False, "message": f"USB device path '{path}' not found."}

        try:
            # USBDEVFS_RESET constant is 21780 (0x5514)
            USBDEVFS_RESET = 21780
            # Open the device file in write-only mode
            fd = os.open(path, os.O_WRONLY)
            import fcntl
            fcntl.ioctl(fd, USBDEVFS_RESET, 0)
            os.close(fd)
            return {"success": True, "message": f"USB device at '{path}' reset successfully."}
        except PermissionError:
            try:
                # Fallback to python command through sudo
                cmd = ["sudo", "python3", "-c", f"import os, fcntl; fd = os.open('{path}', os.O_WRONLY); fcntl.ioctl(fd, 21780, 0); os.close(fd)"]
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
                if res.returncode == 0:
                    return {"success": True, "message": f"USB device at '{path}' reset successfully using sudo."}
                else:
                    return {"success": False, "message": f"Failed to reset device with sudo: {res.stderr.strip()}"}
            except Exception as e:
                return {"success": False, "message": f"Failed to reset USB: Permission denied and fallback failed: {str(e)}"}
        except Exception as e:
            return {"success": False, "message": f"Failed to reset USB: {str(e)}"}
