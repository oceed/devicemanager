import subprocess
import shutil
import tempfile
import os
import re
import json
from app.services.utils import run_host_cmd, check_host_output

# Alias subprocess calls to run on host namespace when possible to avoid version mismatch issues
subprocess.run = run_host_cmd
subprocess.check_output = check_host_output

class NetworkService:
    @staticmethod
    def is_nmcli_available() -> bool:
        return shutil.which("nmcli") is not None

    @classmethod
    def get_interfaces(cls) -> list:
        if not cls.is_nmcli_available():
            # Mock data for local testing
            return [
                {"device": "eth0", "type": "ethernet", "state": "connected", "connection": "Wired connection 1", "ip": "192.168.1.105", "mac": "02:42:ac:11:00:02"},
                {"device": "wlan0", "type": "wifi", "state": "disconnected", "connection": "", "ip": "", "mac": "02:42:ac:11:00:03"},
                {"device": "wg0", "type": "wireguard", "state": "connected", "connection": "office-vpn", "ip": "10.0.0.5", "mac": ""}
            ]
        
        try:
            # Get device status
            output = subprocess.check_output(
                ["nmcli", "-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status"],
                text=True
            ).strip()
            
            interfaces = []
            for line in output.split("\n"):
                if not line.strip():
                    continue
                parts = line.split(":")
                if len(parts) >= 4:
                    device, itype, state, connection = parts[0], parts[1], parts[2], parts[3]
                    
                    # Skip loopback
                    if itype == "loopback":
                        continue
                        
                    # Get IP and MAC address for the device
                    ip = ""
                    mac = ""
                    try:
                        show_out = subprocess.check_output(
                            ["nmcli", "-t", "-f", "IP4.ADDRESS,GENERAL.HWADDR", "device", "show", device],
                            text=True
                        ).strip()
                        for s_line in show_out.split("\n"):
                            if s_line.startswith("IP4.ADDRESS[1]"):
                                ip = s_line.split(":")[1].split("/")[0]
                            elif s_line.startswith("GENERAL.HWADDR"):
                                mac = ":".join(s_line.split(":")[1:])
                    except Exception:
                        pass
                        
                    interfaces.append({
                        "device": device,
                        "type": itype,
                        "state": state,
                        "connection": connection,
                        "ip": ip,
                        "mac": mac
                    })
            return interfaces
        except Exception as e:
            return [{"error": str(e)}]

    @classmethod
    def scan_wifi(cls) -> list:
        if not cls.is_nmcli_available():
            return [
                {"ssid": "Corporate-Main-Wi-Fi", "bssid": "00:11:22:33:44:55", "signal": 95, "security": "WPA2 WPA3", "connected": True, "saved": True},
                {"ssid": "Office-Guest", "bssid": "00:11:22:33:44:66", "signal": 78, "security": "WPA2", "connected": False, "saved": False},
                {"ssid": "ProtectQube-AP-99F1", "bssid": "00:11:22:33:44:77", "signal": 60, "security": "WPA2", "connected": False, "saved": False},
                {"ssid": "Cafe-Free-WiFi", "bssid": "aa:bb:cc:dd:ee:ff", "signal": 45, "security": "None", "connected": False, "saved": False}
            ]
            
        try:
            # Get saved connections to mark them in scan list
            saved_ssids = set()
            try:
                out_saved = subprocess.check_output(
                    ["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"],
                    text=True
                ).strip()
                for line in out_saved.split("\n"):
                    if not line.strip():
                        continue
                    parts = line.split(":")
                    if len(parts) >= 2 and parts[1] == "802-11-wireless":
                        saved_ssids.add(parts[0])
            except Exception:
                pass

            # Rescan wifi networks
            subprocess.run(["nmcli", "device", "wifi", "rescan"], capture_output=True, timeout=5)
            
            output = subprocess.check_output(
                ["nmcli", "-t", "-f", "ACTIVE,SSID,BSSID,SIGNAL,SECURITY", "device", "wifi", "list"],
                text=True
            ).strip()
            
            networks = {}
            for line in output.split("\n"):
                if not line.strip():
                    continue
                parts = line.split(":")
                if len(parts) >= 5:
                    active = parts[0].strip().lower()
                    is_connected = active in ("yes", "*")
                    security = parts[-1]
                    signal = int(parts[-2])
                    bssid = ":".join(parts[-8:-2]) # BSSID is 6 hex bytes
                    ssid = ":".join(parts[1:-8]) # Rest is SSID
                    
                    ssid = ssid.replace("\\:", ":").strip()
                    if not ssid:
                        continue # Skip hidden network
                        
                    # Group by SSID, keep highest signal (or if connected, prioritize connected)
                    if ssid not in networks or networks[ssid]["signal"] < signal or is_connected:
                        networks[ssid] = {
                            "ssid": ssid,
                            "bssid": bssid.replace("\\:", ":"),
                            "signal": signal,
                            "security": security.replace("\\:", ":") if security else "None",
                            "connected": is_connected,
                            "saved": ssid in saved_ssids
                        }
            return list(networks.values())
        except Exception as e:
            return []

    @classmethod
    def connect_wifi(cls, ssid: str, password: str = None) -> dict:
        if not cls.is_nmcli_available():
            return {"success": True, "message": f"Mock: Connected to Wi-Fi '{ssid}' successfully."}
            
        try:
            # 1. Check if a connection profile already exists for this SSID
            existing_conn = None
            try:
                out = subprocess.check_output(
                    ["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"],
                    text=True
                ).strip()
                for line in out.split("\n"):
                    if not line.strip():
                        continue
                    parts = line.split(":")
                    if len(parts) >= 2 and parts[1] == "802-11-wireless" and parts[0] == ssid:
                        existing_conn = parts[0]
                        break
            except Exception:
                pass

            # 2. Connect based on whether profile exists and password is provided
            if existing_conn:
                if password:
                    # Update password in existing profile
                    subprocess.run(["nmcli", "connection", "modify", existing_conn, "802-11-wireless-security.psk", password], check=True)
                # Up the connection
                result = subprocess.run(["nmcli", "connection", "up", existing_conn], capture_output=True, text=True, timeout=20)
                if result.returncode == 0:
                    return {"success": True, "message": f"Successfully connected to saved Wi-Fi: {ssid}"}
                else:
                    # If connecting to saved profile failed, try to connect using wifi connect cmd
                    cmd = ["nmcli", "device", "wifi", "connect", ssid]
                    if password:
                        cmd.extend(["password", password])
                    result2 = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
                    if result2.returncode == 0:
                        return {"success": True, "message": f"Successfully connected to Wi-Fi: {ssid}"}
                    else:
                        return {"success": False, "message": f"Failed to connect to saved Wi-Fi. Retry error: {result2.stderr.strip()}"}
            else:
                # No existing profile, connect as new
                cmd = ["nmcli", "device", "wifi", "connect", ssid]
                if password:
                    cmd.extend(["password", password])
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
                if result.returncode == 0:
                    return {"success": True, "message": f"Successfully connected to Wi-Fi: {ssid}"}
                else:
                    return {"success": False, "message": result.stderr.strip()}
        except Exception as e:
            return {"success": False, "message": str(e)}

    @classmethod
    def configure_ip(cls, device: str, method: str, ip: str = None, gateway: str = None, dns: str = None) -> dict:
        """
        method: 'auto' (DHCP) or 'manual' (Static)
        """
        if not cls.is_nmcli_available():
            return {"success": True, "message": f"Mock: Interface {device} configured to {method} IP: {ip} successfully."}
            
        try:
            # 1. Find active connection name for this device
            interfaces = cls.get_interfaces()
            conn_name = None
            for info in interfaces:
                if info["device"] == device:
                    conn_name = info["connection"]
                    break
                    
            if not conn_name:
                # Fallback to finding any connection profile associated with this interface
                out = subprocess.check_output(
                    ["nmcli", "-t", "-f", "NAME,DEVICE", "connection", "show"],
                    text=True
                ).strip()
                for line in out.split("\n"):
                    parts = line.split(":")
                    if len(parts) >= 2 and parts[1] == device:
                        conn_name = parts[0]
                        break
            
            if not conn_name:
                return {"success": False, "message": f"No active connection profile found for device {device}"}

            # 2. Configure IPv4 settings
            if method == "auto":
                subprocess.run(["nmcli", "connection", "modify", conn_name, "ipv4.method", "auto"], check=True)
                # Clear static IP fields
                subprocess.run(["nmcli", "connection", "modify", conn_name, "ipv4.addresses", "", "ipv4.gateway", "", "ipv4.dns", ""], check=True)
            elif method == "manual":
                if not ip:
                    return {"success": False, "message": "IP address is required for manual (Static) configuration"}
                
                # Check if subnet mask is provided in CIDR notation (e.g. 192.168.1.100/24)
                if "/" not in ip:
                    ip = ip + "/24"  # Default to class C if not specified
                    
                cmd_mod = ["nmcli", "connection", "modify", conn_name, "ipv4.method", "manual", "ipv4.addresses", ip]
                if gateway:
                    cmd_mod.extend(["ipv4.gateway", gateway])
                else:
                    cmd_mod.extend(["ipv4.gateway", ""])
                if dns:
                    cmd_mod.extend(["ipv4.dns", dns])
                else:
                    cmd_mod.extend(["ipv4.dns", ""])
                    
                subprocess.run(cmd_mod, check=True)

            # 3. Reload and Up the connection to apply changes
            subprocess.run(["nmcli", "connection", "reload"], check=True)
            subprocess.run(["nmcli", "connection", "up", conn_name], check=True, timeout=15)
            return {"success": True, "message": f"IP Configuration updated and applied to {device}"}
        except subprocess.CalledProcessError as e:
            err_msg = e.stderr if (hasattr(e, 'stderr') and e.stderr) else (e.stdout if (hasattr(e, 'stdout') and e.stdout) else str(e))
            return {"success": False, "message": f"Subprocess error: {err_msg.strip() if hasattr(err_msg, 'strip') else str(err_msg)}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    @classmethod
    def get_ap_status(cls) -> dict:
        if not cls.is_nmcli_available():
            return {
                "active": False,
                "ssid": "ProtectQube-AP-Mock",
                "password": "password123",
                "interface": "wlan0",
                "ip": "192.168.150.1"
            }
            
        try:
            # Check if AP connection "OrangePi-Hotspot" is active
            output = subprocess.check_output(
                ["nmcli", "-t", "-f", "NAME,STATE,DEVICE", "connection", "show", "--active"],
                text=True
            ).strip()
            
            active = False
            ssid = ""
            interface = ""
            
            for line in output.split("\n"):
                if not line.strip():
                    continue
                parts = line.split(":")
                if len(parts) >= 3 and parts[0] == "OrangePi-Hotspot":
                    active = True
                    interface = parts[2]
                    
            # Read profile details to get SSID and password
            ssid = "OrangePi-Hotspot"
            password = ""
            try:
                details = subprocess.check_output(
                    ["nmcli", "-s", "-g", "802-11-wireless.ssid,802-11-wireless-security.psk", "connection", "show", "OrangePi-Hotspot"],
                    text=True
                ).strip().split("\n")
                if len(details) >= 1 and details[0]:
                    ssid = details[0]
                if len(details) >= 2 and details[1]:
                    password = details[1]
            except Exception:
                pass
                
            return {
                "active": active,
                "ssid": ssid,
                "password": password,
                "interface": interface or "wlan0",
                "ip": "192.168.150.1" if active else ""
            }
        except Exception:
            return {"active": False, "ssid": "", "password": "", "interface": "wlan0", "ip": ""}

    @classmethod
    def set_ap_mode(cls, active: bool, ssid: str = "OrangePi-Hotspot", password: str = "password123", interface: str = "wlan0") -> dict:
        if not cls.is_nmcli_available():
            return {"success": True, "message": f"Mock: Hotspot mode set to {active} with SSID '{ssid}'"}
            
        try:
            con_name = "OrangePi-Hotspot"
            
            # Check if profile exists
            check_con = subprocess.run(["nmcli", "connection", "show", con_name], capture_output=True)
            exists = check_con.returncode == 0
            
            if not active:
                # Bring down AP if active
                if exists:
                    subprocess.run(["nmcli", "connection", "down", con_name], capture_output=True)
                return {"success": True, "message": "Access Point turned off."}

            if not password or len(password) < 8:
                return {"success": False, "message": "WPA2 Password must be at least 8 characters long."}

            # Create or modify the AP profile
            if not exists:
                # Add connection
                subprocess.run([
                    "nmcli", "connection", "add", "type", "wifi", "ifname", interface, "con-name", con_name,
                    "autoconnect", "no", "ssid", ssid
                ], check=True)
            else:
                # Modify SSID
                subprocess.run(["nmcli", "connection", "modify", con_name, "ssid", ssid], check=True)
                
            # Set mode to AP, manual shared IP (automatically starts DHCP server in NetworkManager)
            subprocess.run([
                "nmcli", "connection", "modify", con_name,
                "802-11-wireless.mode", "ap",
                "802-11-wireless.band", "bg",
                "ipv4.method", "shared", # shared method handles NAT, routing, and DHCP
                "wifi-sec.key-mgmt", "wpa-psk",
                "wifi-sec.psk", password
            ], check=True)
            
            # Start AP
            result = subprocess.run(["nmcli", "connection", "up", con_name], capture_output=True, text=True, timeout=15)
            if result.returncode == 0:
                return {"success": True, "message": f"Hotspot activated successfully with SSID: {ssid}"}
            else:
                return {"success": False, "message": f"Failed to activate hotspot: {result.stderr.strip()}"}
                
        except Exception as e:
            return {"success": False, "message": str(e)}

    @classmethod
    def get_vpn_connections(cls) -> list:
        if not cls.is_nmcli_available():
            return [
                {"name": "office-vpn", "type": "wireguard", "active": True, "ip": "10.0.0.5"},
                {"name": "home-wg", "type": "wireguard", "active": False, "ip": ""}
            ]
            
        try:
            output = subprocess.check_output(
                ["nmcli", "-t", "-f", "NAME,TYPE,UUID", "connection", "show"],
                text=True
            ).strip()
            
            # Get active connections
            active_out = subprocess.check_output(
                ["nmcli", "-t", "-f", "NAME,DEVICE", "connection", "show", "--active"],
                text=True
            ).strip().split("\n")
            active_names = {}
            for line in active_out:
                if not line.strip():
                    continue
                parts = line.split(":")
                if len(parts) >= 2:
                    active_names[parts[0]] = parts[1]
            
            vpns = []
            for line in output.split("\n"):
                if not line.strip():
                    continue
                parts = line.split(":")
                if len(parts) >= 3:
                    name, ctype, uuid = parts[0], parts[1], parts[2]
                    
                    if ctype in ("wireguard", "vpn"):
                        is_active = name in active_names
                        dev = active_names.get(name, "")
                        ip = ""
                        
                        if is_active and dev:
                            # Try to extract IP
                            try:
                                ip_out = subprocess.check_output(
                                    ["nmcli", "-t", "-f", "IP4.ADDRESS", "device", "show", dev],
                                    text=True
                                ).strip()
                                for ip_line in ip_out.split("\n"):
                                    if ip_line.startswith("IP4.ADDRESS[1]"):
                                        ip = ip_line.split(":")[1].split("/")[0]
                            except Exception:
                                pass
                                
                        vpns.append({
                            "name": name,
                            "type": ctype,
                            "active": is_active,
                            "ip": ip,
                            "uuid": uuid
                        })
            return vpns
        except Exception:
            return []

    @classmethod
    def add_vpn(cls, name: str, config_content: str, vpn_type: str = "wireguard") -> dict:
        if not cls.is_nmcli_available():
            return {"success": True, "message": f"Mock: {vpn_type} VPN '{name}' imported successfully."}
            
        temp_file = None
        suffix = ".conf" if vpn_type == "wireguard" else ".ovpn"
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, mode="w", delete=False) as f:
                f.write(config_content)
                temp_file = f.name
                
            cmd = ["nmcli", "connection", "import", "type", vpn_type, "file", temp_file]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            imported_name = os.path.basename(temp_file).replace(suffix, "")
            
            if result.returncode == 0:
                if name and name != imported_name:
                    subprocess.run(["nmcli", "connection", "modify", imported_name, "connection.id", name])
                return {"success": True, "message": f"{vpn_type} profile '{name or imported_name}' imported successfully"}
            else:
                return {"success": False, "message": f"Failed to import: {result.stderr.strip()}"}
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            if temp_file and os.path.exists(temp_file):
                os.remove(temp_file)

    @classmethod
    def add_wireguard_vpn(cls, name: str, config_content: str) -> dict:
        return cls.add_vpn(name, config_content, "wireguard")

    @classmethod
    def toggle_vpn(cls, name: str, active: bool) -> dict:
        if not cls.is_nmcli_available():
            return {"success": True, "message": f"Mock: VPN '{name}' status set to {active}."}
            
        try:
            action = "up" if active else "down"
            result = subprocess.run(["nmcli", "connection", action, name], capture_output=True, text=True, timeout=15)
            if result.returncode == 0:
                return {"success": True, "message": f"VPN '{name}' {'connected' if active else 'disconnected'} successfully"}
            else:
                return {"success": False, "message": result.stderr.strip()}
        except Exception as e:
            return {"success": False, "message": str(e)}

    @classmethod
    def delete_vpn(cls, name: str) -> dict:
        if not cls.is_nmcli_available():
            return {"success": True, "message": f"Mock: VPN '{name}' deleted."}
            
        try:
            result = subprocess.run(["nmcli", "connection", "delete", name], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                return {"success": True, "message": f"VPN Profile '{name}' deleted successfully"}
            else:
                return {"success": False, "message": result.stderr.strip()}
        except Exception as e:
            return {"success": False, "message": str(e)}

    @staticmethod
    def is_tailscale_available() -> bool:
        return shutil.which("tailscale") is not None

    @classmethod
    def get_tailscale_status(cls) -> dict:
        if not cls.is_tailscale_available():
            return {
                "installed": False,
                "active": False,
                "ip": "",
                "node_name": "",
                "status": "Not Installed"
            }
        try:
            result = subprocess.run(["tailscale", "status"], capture_output=True, text=True, timeout=5)
            if result.returncode != 0:
                is_active = False
                try:
                    active_check = subprocess.run(["systemctl", "is-active", "tailscaled"], capture_output=True, text=True)
                    is_active = active_check.stdout.strip() == "active"
                except Exception:
                    pass
                return {
                    "installed": True,
                    "active": is_active,
                    "ip": "",
                    "node_name": "",
                    "status": "Disconnected or Stopped"
                }
            
            lines = result.stdout.strip().split("\n")
            if not lines or not lines[0].strip():
                return {
                    "installed": True,
                    "active": True,
                    "ip": "",
                    "node_name": "",
                    "status": "Active (No connections)"
                }
            
            self_line = None
            for line in lines:
                if "self" in line:
                    self_line = line
                    break
            
            if not self_line and lines:
                self_line = lines[0]
                
            parts = self_line.split()
            if len(parts) >= 2:
                ip = parts[0]
                node_name = parts[1]
                return {
                    "installed": True,
                    "active": True,
                    "ip": ip,
                    "node_name": node_name,
                    "status": "Connected"
                }
            
            return {
                "installed": True,
                "active": True,
                "ip": "",
                "node_name": "",
                "status": "Active"
            }
        except Exception as e:
            return {
                "installed": True,
                "active": False,
                "ip": "",
                "node_name": "",
                "status": f"Error: {str(e)}"
            }

    @classmethod
    def toggle_tailscale(cls, active: bool) -> dict:
        if not cls.is_tailscale_available():
            return {"success": False, "message": "Tailscale is not installed on this system."}
        try:
            cmd = ["sudo", "tailscale", "up" if active else "down"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if result.returncode == 0:
                return {"success": True, "message": f"Tailscale successfully turned {'on' if active else 'off'}."}
            else:
                return {"success": False, "message": f"Tailscale error: {result.stderr.strip()}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    @staticmethod
    def is_mmcli_available() -> bool:
        return shutil.which("mmcli") is not None

    @classmethod
    def list_modems(cls) -> list:
        if not cls.is_mmcli_available():
            return [
                {"id": "0", "manufacturer": "Quectel", "model": "EC25-E", "path": "/org/freedesktop/ModemManager1/Modem/0"}
            ]
        try:
            output = subprocess.check_output(["mmcli", "-L"], text=True).strip()
            modems = []
            pattern = re.compile(r"(/org/freedesktop/ModemManager1/Modem/(\d+))\s+\[([^\]]+)\]\s+(.*)")
            for line in output.split("\n"):
                match = pattern.search(line)
                if match:
                    path, idx, manufacturer, model = match.groups()
                    modems.append({
                        "id": idx,
                        "manufacturer": manufacturer.strip(),
                        "model": model.strip(),
                        "path": path
                    })
            return modems
        except Exception:
            return []

    @classmethod
    def get_modem_info(cls, modem_id: str = "0") -> dict:
        if not cls.is_mmcli_available():
            return {
                "id": modem_id,
                "manufacturer": "Quectel",
                "model": "EC25-E",
                "state": "connected",
                "power_state": "on",
                "signal_quality": "84",
                "access_tech": "lte",
                "operator_name": "Telkomsel",
                "operator_code": "51010",
                "ip": "10.64.23.105",
                "imei": "862309047281923",
                "iccid": "8962019283719283712",
                "success": True
            }
        
        try:
            result = subprocess.run(["mmcli", "-m", modem_id, "-j"], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                data = json.loads(result.stdout)
                modem = data.get("modem", {})
                generic = modem.get("generic", {})
                tgpp = modem.get("3gpp", {})
                
                ip_addr = ""
                try:
                    bearers = generic.get("bearers", [])
                    if bearers:
                        bearer_path = bearers[0]
                        bearer_id = bearer_path.split("/")[-1]
                        b_res = subprocess.run(["mmcli", "-b", bearer_id, "-j"], capture_output=True, text=True, timeout=5)
                        if b_res.returncode == 0:
                            b_data = json.loads(b_res.stdout)
                            ip_addr = b_data.get("bearer", {}).get("ipv4-config", {}).get("address", "")
                except Exception:
                    pass

                return {
                    "id": modem_id,
                    "manufacturer": generic.get("manufacturer", "Unknown"),
                    "model": generic.get("model", "Unknown"),
                    "state": generic.get("state", "unknown"),
                    "power_state": generic.get("power-state", "unknown"),
                    "signal_quality": str(generic.get("signal-quality", {}).get("value", "0")),
                    "access_tech": ", ".join(generic.get("access-technologies", [])),
                    "operator_name": tgpp.get("operator-name", "Unknown"),
                    "operator_code": tgpp.get("operator-code", "Unknown"),
                    "ip": ip_addr,
                    "imei": tgpp.get("imei", ""),
                    "iccid": modem.get("sim", {}).get("iccid", "Unknown"),
                    "success": True
                }
        except Exception:
            pass

        try:
            output = subprocess.check_output(["mmcli", "-m", modem_id], text=True).strip()
            info = {"id": modem_id, "success": True}
            
            for line in output.split("\n"):
                if ":" not in line:
                    continue
                key, val = line.split(":", 1)
                key = key.strip().lower()
                val = val.strip()
                
                if "manufacturer" in key:
                    info["manufacturer"] = val
                elif "model" in key:
                    info["model"] = val
                elif "state" in key and "power" not in key:
                    info["state"] = val
                elif "power state" in key:
                    info["power_state"] = val
                elif "signal quality" in key:
                    m = re.search(r"(\d+)", val)
                    info["signal_quality"] = m.group(1) if m else "0"
                elif "access tech" in key or "access technologies" in key:
                    info["access_tech"] = val
                elif "operator name" in key:
                    info["operator_name"] = val
                elif "operator code" in key:
                    info["operator_code"] = val
                elif "imei" in key:
                    info["imei"] = val
                elif "iccid" in key:
                    info["iccid"] = val
            
            return info
        except Exception as e:
            return {"success": False, "error": str(e)}

    @classmethod
    def toggle_interface_or_radio(cls, active: bool, device: str = None, connection: str = None, radio: str = None) -> dict:
        if not cls.is_nmcli_available():
            return {"success": True, "message": f"Mock: Toggled interface/connection/radio active={active}"}
        try:
            if radio == "wifi":
                action = "on" if active else "off"
                result = subprocess.run(["nmcli", "radio", "wifi", action], capture_output=True, text=True, timeout=10)
            elif connection:
                action = "up" if active else "down"
                result = subprocess.run(["nmcli", "connection", action, connection], capture_output=True, text=True, timeout=15)
            elif device:
                action = "connect" if active else "disconnect"
                result = subprocess.run(["nmcli", "device", action, device], capture_output=True, text=True, timeout=15)
            else:
                return {"success": False, "message": "Specify device, connection, or radio to toggle."}
            
            if result.returncode == 0:
                return {"success": True, "message": "Successfully toggled connectivity status."}
            else:
                return {"success": False, "message": result.stderr.strip()}
        except Exception as e:
            return {"success": False, "message": str(e)}

    @classmethod
    def disconnect_wifi(cls) -> dict:
        if not cls.is_nmcli_available():
            return {"success": True, "message": "Mock: Wi-Fi disconnected successfully."}
        try:
            interfaces = cls.get_interfaces()
            wlan_dev = None
            for info in interfaces:
                if info.get("type") == "wifi":
                    wlan_dev = info.get("device")
                    break
            if not wlan_dev:
                wlan_dev = "wlan0"
            
            result = subprocess.run(["nmcli", "device", "disconnect", wlan_dev], capture_output=True, text=True, timeout=15)
            if result.returncode == 0:
                return {"success": True, "message": "Wi-Fi interface disconnected successfully."}
            else:
                return {"success": False, "message": result.stderr.strip()}
        except Exception as e:
            return {"success": False, "message": str(e)}



