import os
import time
import json
import threading
import subprocess
import shutil
from datetime import datetime

class WatchdogService:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if not cls._instance:
                cls._instance = super(WatchdogService, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if getattr(self, '_initialized', False):
            return
        
        self.config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "watchdog_config.json")
        self.enabled = False
        self.ping_target = "8.8.8.8"
        self.interval = 30
        self.fail_threshold = 3
        self.fail_count = 0
        self.logs = []
        self.max_logs = 100
        
        self.running = False
        self.thread = None
        self.last_check_time = None
        self.last_check_status = "unknown"
        self.last_healing_time = None
        self.last_healing_action = None
        self.healing_cooldown_until = 0

        self.load_config()
        self._initialized = True

    def load_config(self):
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r") as f:
                    data = json.load(f)
                    self.enabled = data.get("enabled", False)
                    self.ping_target = data.get("ping_target", "8.8.8.8")
                    self.interval = data.get("interval", 30)
                    self.fail_threshold = data.get("fail_threshold", 3)
                self.add_log(f"Watchdog config loaded. Enabled: {self.enabled}, Target: {self.ping_target}")
        except Exception as e:
            self.add_log(f"Error loading config: {str(e)}")

    def save_config(self):
        try:
            data = {
                "enabled": self.enabled,
                "ping_target": self.ping_target,
                "interval": self.interval,
                "fail_threshold": self.fail_threshold
            }
            with open(self.config_path, "w") as f:
                json.dump(data, f, indent=4)
            self.add_log(f"Watchdog config saved. Enabled: {self.enabled}, Target: {self.ping_target}")
        except Exception as e:
            self.add_log(f"Error saving config: {str(e)}")

    def add_log(self, message: str):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = {"timestamp": timestamp, "message": message}
        self.logs.insert(0, log_entry)
        if len(self.logs) > self.max_logs:
            self.logs = self.logs[:self.max_logs]

    def clear_logs(self):
        self.logs = []
        self.add_log("Logs cleared.")

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()
        self.add_log("Watchdog background service started.")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
            self.thread = None
        self.add_log("Watchdog background service stopped.")

    def ping_check(self) -> bool:
        is_windows = os.name == 'nt'
        if is_windows:
            cmd = ["ping", "-n", "1", "-w", "2000", self.ping_target]
        else:
            cmd = ["ping", "-c", "1", "-W", "2", self.ping_target]
        
        try:
            result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return result.returncode == 0
        except Exception:
            return False

    def _loop(self):
        while self.running:
            if self.enabled:
                current_time = time.time()
                if current_time < self.healing_cooldown_until:
                    # Under cooldown from a recent recovery action
                    time.sleep(5)
                    continue

                self.last_check_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                success = self.ping_check()
                
                if success:
                    if self.fail_count > 0:
                        self.add_log(f"Connectivity restored to {self.ping_target}. Resetting fail count.")
                    self.fail_count = 0
                    self.last_check_status = "online"
                else:
                    self.fail_count += 1
                    self.last_check_status = "offline"
                    self.add_log(f"Ping to {self.ping_target} failed. Failure count: {self.fail_count}/{self.fail_threshold}")
                    
                    if self.fail_count >= self.fail_threshold:
                        self.add_log(f"Threshold reached ({self.fail_threshold}). Triggering auto-heal recovery sequence...")
                        self.trigger_healing()
                        self.fail_count = 0  # Reset counter
            time.sleep(self.interval)

    def trigger_healing(self) -> str:
        self.last_healing_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.healing_cooldown_until = time.time() + 60  # 60s cooldown

        if os.name != 'posix' or shutil.which("nmcli") is None:
            action = "Mock Healing Action (Dev environment - no NetworkManager)"
            self.last_healing_action = action
            self.add_log(f"Auto-heal triggered: {action}")
            return action

        try:
            devices_out = subprocess.check_output(
                ["nmcli", "-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status"],
                text=True
            ).strip()
            
            wlan_active = False
            modem_active = False
            active_wifi_conn = None
            active_modem_conn = None

            for line in devices_out.split("\n"):
                if not line.strip():
                    continue
                parts = line.split(":")
                if len(parts) >= 4:
                    device, itype, state, connection = parts[0], parts[1], parts[2], parts[3]
                    if state == "connected":
                        if itype == "wifi":
                            wlan_active = True
                            active_wifi_conn = connection
                        elif itype in ("gsm", "cdma"):
                            modem_active = True
                            active_modem_conn = connection

            if wlan_active and active_wifi_conn:
                action = f"Restarting Wi-Fi Connection '{active_wifi_conn}' and toggling Wi-Fi radio"
                self.last_healing_action = action
                self.add_log(f"Auto-heal action: {action}")
                
                subprocess.run(["nmcli", "connection", "down", active_wifi_conn], capture_output=True)
                subprocess.run(["nmcli", "radio", "wifi", "off"], capture_output=True)
                time.sleep(2)
                subprocess.run(["nmcli", "radio", "wifi", "on"], capture_output=True)
                time.sleep(3)
                subprocess.run(["nmcli", "connection", "up", active_wifi_conn], capture_output=True)
                return action

            elif modem_active:
                action = "Restarting ModemManager systemd service"
                self.last_healing_action = action
                self.add_log(f"Auto-heal action: {action}")
                subprocess.run(["sudo", "systemctl", "restart", "ModemManager"], capture_output=True)
                return action

            else:
                action = "Restarting NetworkManager systemd service"
                self.last_healing_action = action
                self.add_log(f"Auto-heal action: {action}")
                subprocess.run(["sudo", "systemctl", "restart", "NetworkManager"], capture_output=True)
                return action

        except Exception as e:
            action = f"Fallback NetworkManager restart due to error: {str(e)}"
            self.last_healing_action = action
            self.add_log(f"Auto-heal action failed. Fallback: {action}")
            subprocess.run(["sudo", "systemctl", "restart", "NetworkManager"], capture_output=True)
            return action

    def get_status(self) -> dict:
        return {
            "enabled": self.enabled,
            "ping_target": self.ping_target,
            "interval": self.interval,
            "fail_threshold": self.fail_threshold,
            "fail_count": self.fail_count,
            "last_check_time": self.last_check_time,
            "last_check_status": self.last_check_status,
            "last_healing_time": self.last_healing_time,
            "last_healing_action": self.last_healing_action,
            "logs": self.logs
        }
