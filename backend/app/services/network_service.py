import subprocess
import shutil
import tempfile
import os

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
                {"ssid": "Corporate-Main-Wi-Fi", "bssid": "00:11:22:33:44:55", "signal": 95, "security": "WPA2 WPA3"},
                {"ssid": "Office-Guest", "bssid": "00:11:22:33:44:66", "signal": 78, "security": "WPA2"},
                {"ssid": "ProtectQube-AP-99F1", "bssid": "00:11:22:33:44:77", "signal": 60, "security": "WPA2"},
                {"ssid": "Cafe-Free-WiFi", "bssid": "aa:bb:cc:dd:ee:ff", "signal": 45, "security": "None"}
            ]
            
        try:
            # Rescan wifi networks
            subprocess.run(["nmcli", "device", "wifi", "rescan"], capture_output=True, timeout=5)
            
            output = subprocess.check_output(
                ["nmcli", "-t", "-f", "SSID,BSSID,SIGNAL,SECURITY", "device", "wifi", "list"],
                text=True
            ).strip()
            
            networks = {}
            for line in output.split("\n"):
                if not line.strip():
                    continue
                # SSID might contain colons, nmcli -t uses backslash escapes for colons
                # E.g. SSID\:Name:BSSID:SIGNAL:SECURITY
                # A safer split is done backwards or using regex
                parts = line.split(":")
                if len(parts) >= 4:
                    security = parts[-1]
                    signal = int(parts[-2])
                    bssid = ":".join(parts[-8:-2]) # BSSID is 6 hex bytes
                    ssid = ":".join(parts[0:-8]) # Rest is SSID
                    
                    ssid = ssid.replace("\\:", ":").strip()
                    if not ssid:
                        continue # Skip hidden network
                        
                    # Group by SSID, keep highest signal
                    if ssid not in networks or networks[ssid]["signal"] < signal:
                        networks[ssid] = {
                            "ssid": ssid,
                            "bssid": bssid.replace("\\:", ":"),
                            "signal": signal,
                            "security": security.replace("\\:", ":") if security else "None"
                        }
            return list(networks.values())
        except Exception as e:
            return []

    @classmethod
    def connect_wifi(cls, ssid: str, password: str) -> dict:
        if not cls.is_nmcli_available():
            return {"success": True, "message": f"Mock: Connected to Wi-Fi '{ssid}' successfully."}
            
        try:
            cmd = ["nmcli", "device", "wifi", "connect", ssid]
            if password:
                cmd.extend(["password", password])
                
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
            if result.returncode == 0:
                return {"success": True, "message": f"Successfully connected to {ssid}"}
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
                if dns:
                    cmd_mod.extend(["ipv4.dns", dns])
                    
                subprocess.run(cmd_mod, check=True)

            # 3. Reload and Up the connection to apply changes
            subprocess.run(["nmcli", "connection", "up", conn_name], check=True, timeout=15)
            return {"success": True, "message": f"IP Configuration updated and applied to {device}"}
        except subprocess.CalledProcessError as e:
            return {"success": False, "message": f"Subprocess error: {e.stderr if hasattr(e, 'stderr') else str(e)}"}
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
    def add_wireguard_vpn(cls, name: str, config_content: str) -> dict:
        if not cls.is_nmcli_available():
            return {"success": True, "message": f"Mock: WireGuard VPN '{name}' imported successfully."}
            
        # Write config to a temporary file, then import
        temp_file = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".conf", mode="w", delete=False) as f:
                f.write(config_content)
                temp_file = f.name
                
            # nmcli connection import type wireguard file /path/to/conf
            # Need to see if we need to rename it or if it imports using the file name
            # Let's import it
            cmd = ["nmcli", "connection", "import", "type", "wireguard", "file", temp_file]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            # The connection profile name will match the config filename (excluding .conf)
            # We can rename it to the requested 'name' if necessary
            imported_name = os.path.basename(temp_file).replace(".conf", "")
            
            if result.returncode == 0:
                if name and name != imported_name:
                    subprocess.run(["nmcli", "connection", "modify", imported_name, "connection.id", name])
                return {"success": True, "message": f"WireGuard profile '{name or imported_name}' imported successfully"}
            else:
                return {"success": False, "message": f"Failed to import: {result.stderr.strip()}"}
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            if temp_file and os.path.exists(temp_file):
                os.remove(temp_file)

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
