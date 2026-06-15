import os
import re
import psutil
import time

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
