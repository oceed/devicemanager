import os
import re
import psutil
import time
import subprocess

class SystemService:
    @staticmethod
    def get_uptime() -> float:
        try:
            with open("/proc/uptime", "r") as f:
                uptime_seconds = float(f.readline().split()[0])
                return uptime_seconds
        except Exception:
            return 0.0

    @staticmethod
    def get_cpu_info() -> dict:
        try:
            cpu_percent = psutil.cpu_percent(interval=None)
            cpu_count = psutil.cpu_count(logical=True)
            cpu_cores_percent = psutil.cpu_percent(interval=None, percpu=True)
            
            freq = psutil.cpu_freq()
            cpu_freq_current = freq.current if freq else 0.0
            cpu_freq_max = freq.max if freq else 0.0
            
            return {
                "percent": cpu_percent,
                "cores_percent": cpu_cores_percent,
                "count": cpu_count,
                "frequency_mhz": {
                    "current": cpu_freq_current,
                    "max": cpu_freq_max
                }
            }
        except Exception as e:
            return {"percent": 0.0, "cores_percent": [], "count": 1, "error": str(e)}

    @staticmethod
    def get_memory_info() -> dict:
        try:
            mem = psutil.virtual_memory()
            return {
                "total_gb": round(mem.total / (1024 ** 3), 2),
                "used_gb": round(mem.used / (1024 ** 3), 2),
                "free_gb": round(mem.available / (1024 ** 3), 2),
                "percent": mem.percent
            }
        except Exception as e:
            return {"total_gb": 0.0, "used_gb": 0.0, "free_gb": 0.0, "percent": 0.0, "error": str(e)}

    @staticmethod
    def get_disk_info() -> dict:
        try:
            usage = psutil.disk_usage('/')
            return {
                "total_gb": round(usage.total / (1024 ** 3), 2),
                "used_gb": round(usage.used / (1024 ** 3), 2),
                "free_gb": round(usage.free / (1024 ** 3), 2),
                "percent": usage.percent
            }
        except Exception as e:
            return {"total_gb": 0.0, "used_gb": 0.0, "free_gb": 0.0, "percent": 0.0, "error": str(e)}

    @staticmethod
    def get_temperatures() -> dict:
        temps = {}
        # Try reading from thermal zones (Ubuntu / Debian standard)
        thermal_path = "/sys/class/thermal"
        try:
            if os.path.exists(thermal_path):
                zones = [d for d in os.listdir(thermal_path) if d.startswith("thermal_zone")]
                for zone in zones:
                    type_file = os.path.join(thermal_path, zone, "type")
                    temp_file = os.path.join(thermal_path, zone, "temp")
                    
                    if os.path.exists(type_file) and os.path.exists(temp_file):
                        with open(type_file, "r") as tf:
                            zone_type = tf.readline().strip()
                        with open(temp_file, "r") as temp_f:
                            raw_temp = float(temp_f.readline().strip())
                            temp_c = round(raw_temp / 1000.0, 1)
                        temps[zone_type] = temp_c
            
            # Fallback to psutil sensors_temperatures
            if not temps:
                ps_temps = psutil.sensors_temperatures()
                for key, entries in ps_temps.items():
                    for entry in entries:
                        label = entry.label if entry.label else key
                        temps[label] = entry.current
        except Exception:
            pass
            
        # Fallback default values for development environment
        if not temps:
            temps = {
                "cpu-thermal": 45.5,
                "gpu-thermal": 42.0,
                "npu-thermal": 40.2
            }
        return temps

    @staticmethod
    def get_npu_load() -> dict:
        """
        Reads RK3588 NPU load.
        On Orange Pi 5, this is usually read from `/sys/kernel/debug/rknpu/load`.
        Content is like: 'NPU load: Core0: 10%, Core1: 0%, Core2: 5%'
        """
        npu_debug_path = "/sys/kernel/debug/rknpu/load"
        try:
            if os.path.exists(npu_debug_path):
                with open(npu_debug_path, "r") as f:
                    content = f.read().strip()
                
                # Parse NPU load percentages
                # Core0: 0%, Core1: 0%, Core2: 0%
                cores = re.findall(r"Core\d+:\s*(\d+)%", content)
                if cores:
                    loads = [int(load) for load in cores]
                    avg_load = sum(loads) / len(loads)
                    return {
                        "supported": True,
                        "cores": {f"Core{i}": load for i, load in enumerate(loads)},
                        "average": round(avg_load, 1)
                    }
            
            # Try alternative path for device frequencies if NPU percent is exposed
            devfreq_npu_path = "/sys/class/devfreq/fb000000.npu/percent"
            if os.path.exists(devfreq_npu_path):
                with open(devfreq_npu_path, "r") as f:
                    content = f.read().strip()
                    val = int(content)
                    return {
                        "supported": True,
                        "cores": {"Core0": val},
                        "average": val
                    }
        except Exception:
            pass
            
        # Mock load for local testing if running on Windows/Mac/x86 Linux
        return {
            "supported": False,
            "cores": {"Core0": 0},
            "average": 0.0
        }

    @staticmethod
    def get_service_status(service_name: str) -> str:
        if os.name != 'posix':
            # Mock data for local testing
            if service_name in ("NetworkManager", "ModemManager", "wpa_supplicant", "voiceguard", "protectqube", "device-manager-backend"):
                return "active"
            return "inactive"
        try:
            result = subprocess.run(["systemctl", "show", "-p", "LoadState", "-p", "ActiveState", service_name], capture_output=True, text=True, timeout=5)
            lines = result.stdout.strip().split("\n")
            load_state = "unknown"
            active_state = "inactive"
            for line in lines:
                if line.startswith("LoadState="):
                    load_state = line.split("=")[1]
                elif line.startswith("ActiveState="):
                    active_state = line.split("=")[1]
            
            if load_state == "not-found":
                return "not-installed"
            return active_state
        except Exception:
            return "inactive"

    @classmethod
    def get_services(cls) -> list:
        services = [
            "NetworkManager", 
            "ModemManager", 
            "wpa_supplicant", 
            "tailscaled", 
            "voiceguard", 
            "protectqube", 
            "device-manager-backend", 
            "device-manager-frontend"
        ]
        statuses = []
        for s in services:
            statuses.append({
                "name": s,
                "status": cls.get_service_status(s)
            })
        return statuses

    @classmethod
    def control_service(cls, service_name: str, action: str) -> dict:
        allowed_services = (
            "NetworkManager", 
            "ModemManager", 
            "wpa_supplicant", 
            "tailscaled", 
            "voiceguard", 
            "protectqube", 
            "device-manager-backend", 
            "device-manager-frontend"
        )
        if service_name not in allowed_services:
            return {"success": False, "message": f"Service '{service_name}' is not in the whitelist."}
        if action not in ("start", "stop", "restart"):
            return {"success": False, "message": f"Action '{action}' is not supported. Use start, stop, or restart."}
            
        if os.name != 'posix':
            return {"success": True, "message": f"Mock: Successfully performed '{action}' on service '{service_name}'."}
        try:
            result = subprocess.run(["sudo", "systemctl", action, service_name], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                return {"success": True, "message": f"Successfully performed '{action}' on service '{service_name}'."}
            else:
                return {"success": False, "message": f"Failed to execute {action} on service: {result.stderr.strip()}"}
        except Exception as e:
            return {"success": False, "message": f"Failed to control service: {str(e)}"}

    @staticmethod
    def get_multimedia_devices() -> dict:
        cameras = []
        microphones = []
        
        # 1. Cameras
        v4l_path = "/sys/class/video4linux"
        if os.path.exists(v4l_path) and os.name == 'posix':
            try:
                for d in os.listdir(v4l_path):
                    name_file = os.path.join(v4l_path, d, "name")
                    if os.path.exists(name_file):
                        with open(name_file, "r") as f:
                            name = f.read().strip()
                        cameras.append({
                            "device": f"/dev/{d}",
                            "name": name,
                            "type": "camera"
                        })
            except Exception:
                pass
        else:
            cameras = [{"device": "/dev/video0", "name": "Orange Pi Camera Module (OV13850)", "type": "camera"}]
            
        # 2. Microphones
        asound_cards = "/proc/asound/cards"
        if os.path.exists(asound_cards) and os.name == 'posix':
            try:
                with open(asound_cards, "r") as f:
                    content = f.read().strip()
                lines = content.split("\n")
                for i in range(0, len(lines), 2):
                    line = lines[i].strip()
                    if not line:
                        continue
                    match = re.match(r"^\s*(\d+)\s+\[([^\]]+)\]:\s+(.*)$", line)
                    if match:
                        idx, short_name, desc = match.groups()
                        microphones.append({
                            "id": idx,
                            "name": f"{short_name.strip()} ({desc.strip()})",
                            "type": "microphone"
                        })
            except Exception:
                pass
        else:
            microphones = [{"id": "0", "name": "RK809 Audio Capture (Analog Microphone)", "type": "microphone"}]
            
        return {
            "cameras": cameras,
            "microphones": microphones
        }

    @staticmethod
    def check_projects_installed() -> dict:
        docker_mount_path = "/project_siblings"
        current_dir = os.path.dirname(os.path.abspath(__file__))
        app_dir = os.path.dirname(current_dir)
        backend_dir = os.path.dirname(app_dir)
        dm_dir = os.path.dirname(backend_dir)
        project_dir = os.path.dirname(dm_dir)
        
        has_protectqube = False
        has_voiceguard = False
        
        if os.path.exists(docker_mount_path):
            has_protectqube = os.path.exists(os.path.join(docker_mount_path, "protectqube-ai"))
            has_voiceguard = os.path.exists(os.path.join(docker_mount_path, "voiceguard"))
        else:
            has_protectqube = os.path.exists(os.path.join(project_dir, "protectqube-ai"))
            has_voiceguard = os.path.exists(os.path.join(project_dir, "voiceguard"))
            
        return {
            "protectqube": has_protectqube,
            "voiceguard": has_voiceguard,
            "devicemanager": True
        }



    @classmethod
    def get_all_metrics(cls) -> dict:
        return {
            "timestamp": time.time(),
            "uptime": cls.get_uptime(),
            "cpu": cls.get_cpu_info(),
            "memory": cls.get_memory_info(),
            "disk": cls.get_disk_info(),
            "temperatures": cls.get_temperatures(),
            "npu": cls.get_npu_load()
        }

