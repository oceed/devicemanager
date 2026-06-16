import os
import time
import json
import socket
import threading
from datetime import datetime
import paho.mqtt.client as mqtt
from app.services.system_service import SystemService

class MqttService:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if not cls._instance:
                cls._instance = super(MqttService, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if getattr(self, '_initialized', False):
            return
        
        self.config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
            "mqtt_config.json"
        )
        
        # Determine a default device ID based on hostname
        try:
            default_device_id = socket.gethostname()
        except Exception:
            default_device_id = "orange-pi-edge"

        # Defaults
        self.enabled = False
        self.broker_host = "localhost"
        self.broker_port = 1883
        self.username = ""
        self.password = ""
        self.device_id = default_device_id
        self.heartbeat_topic = f"device/{default_device_id}/heartbeat"
        self.heartbeat_interval = 30
        self.telemetry_topic = f"device/{default_device_id}/telemetry"
        self.telemetry_interval = 60
        
        # Runtime states
        self.running = False
        self.connection_status = "disconnected"
        self.error_message = None
        self._mqtt_client = None
        self._start_time = time.monotonic()
        
        self._hb_thread = None
        self._tel_thread = None
        self._stop_event = threading.Event()
        
        self.load_config()
        self._initialized = True

    def load_config(self):
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r") as f:
                    data = json.load(f)
                    self.enabled = data.get("enabled", False)
                    self.broker_host = data.get("broker_host", "localhost")
                    self.broker_port = data.get("broker_port", 1883)
                    self.username = data.get("username", "")
                    self.password = data.get("password", "")
                    self.device_id = data.get("device_id", self.device_id)
                    self.heartbeat_topic = data.get("heartbeat_topic", f"device/{self.device_id}/heartbeat")
                    self.heartbeat_interval = int(data.get("heartbeat_interval", 30))
                    self.telemetry_topic = data.get("telemetry_topic", f"device/{self.device_id}/telemetry")
                    self.telemetry_interval = int(data.get("telemetry_interval", 60))
        except Exception as e:
            self.error_message = f"Error loading config: {str(e)}"

    def save_config(self):
        try:
            data = {
                "enabled": self.enabled,
                "broker_host": self.broker_host,
                "broker_port": self.broker_port,
                "username": self.username,
                "password": self.password,
                "device_id": self.device_id,
                "heartbeat_topic": self.heartbeat_topic,
                "heartbeat_interval": self.heartbeat_interval,
                "telemetry_topic": self.telemetry_topic,
                "telemetry_interval": self.telemetry_interval
            }
            with open(self.config_path, "w") as f:
                json.dump(data, f, indent=4)
        except Exception as e:
            self.error_message = f"Error saving config: {str(e)}"

    def get_status(self) -> dict:
        return {
            "enabled": self.enabled,
            "broker_host": self.broker_host,
            "broker_port": self.broker_port,
            "username": self.username,
            "password": self.password,
            "device_id": self.device_id,
            "heartbeat_topic": self.heartbeat_topic,
            "heartbeat_interval": self.heartbeat_interval,
            "telemetry_topic": self.telemetry_topic,
            "telemetry_interval": self.telemetry_interval,
            "connection_status": self.connection_status,
            "error_message": self.error_message
        }

    def start(self):
        if self.running:
            return
        
        self.running = True
        self._stop_event.clear()
        
        if self.enabled:
            self._connect_client()
            self._start_loops()

    def stop(self):
        self.running = False
        self._stop_event.set()
        
        self._disconnect_client()
        
        # Wait for threads to join
        if self._hb_thread:
            self._hb_thread.join(timeout=2)
            self._hb_thread = None
        if self._tel_thread:
            self._tel_thread.join(timeout=2)
            self._tel_thread = None

    def _connect_client(self):
        try:
            self.connection_status = "connecting"
            self.error_message = None
            
            client = mqtt.Client(client_id=f"{self.device_id}-manager-{int(time.time())}")
            if self.username:
                client.username_pw_set(self.username, self.password or None)
                
            client.on_connect = self._on_connect
            client.on_disconnect = self._on_disconnect
            
            # Connect asynchronously so startup isn't blocked if broker is offline
            client.connect_async(self.broker_host, self.broker_port, 60)
            client.loop_start()
            self._mqtt_client = client
        except Exception as e:
            self.connection_status = "error"
            self.error_message = f"Failed to connect: {str(e)}"
            self._mqtt_client = None

    def _disconnect_client(self):
        if self._mqtt_client:
            try:
                self._mqtt_client.loop_stop()
                self._mqtt_client.disconnect()
            except Exception:
                pass
            self._mqtt_client = None
        self.connection_status = "disconnected"

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.connection_status = "connected"
            self.error_message = None
        else:
            self.connection_status = "error"
            if rc == 1:
                self.error_message = "Connection refused - incorrect protocol version"
            elif rc == 2:
                self.error_message = "Connection refused - invalid client identifier"
            elif rc == 3:
                self.error_message = "Connection refused - server unavailable"
            elif rc == 4:
                self.error_message = "Connection refused - bad username or password"
            elif rc == 5:
                self.error_message = "Connection refused - not authorized"
            else:
                self.error_message = f"Connection failed with code {rc}"

    def _on_disconnect(self, client, userdata, rc):
        if self.connection_status != "disconnected":
            self.connection_status = "disconnected"
            if rc != 0:
                self.error_message = f"Unexpected disconnection (code {rc})"

    def _start_loops(self):
        self._hb_thread = threading.Thread(target=self._heartbeat_loop, daemon=True, name="mqtt-heartbeat")
        self._tel_thread = threading.Thread(target=self._telemetry_loop, daemon=True, name="mqtt-telemetry")
        self._hb_thread.start()
        self._tel_thread.start()

    def _heartbeat_loop(self):
        # Initial sleep to allow connection
        time.sleep(2)
        while not self._stop_event.is_set():
            if self.enabled and self.connection_status == "connected" and self._mqtt_client:
                try:
                    payload = {
                        "device_id": self.device_id,
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "status": "online",
                        "uptime_seconds": int(time.monotonic() - self._start_time)
                    }
                    self._mqtt_client.publish(self.heartbeat_topic, json.dumps(payload), qos=1)
                except Exception:
                    pass
            # Wait for interval, checking stop_event periodically
            interval = max(1, self.heartbeat_interval)
            for _ in range(int(interval)):
                if self._stop_event.is_set():
                    break
                time.sleep(1)

    def _telemetry_loop(self):
        # Initial sleep to allow connection
        time.sleep(3)
        while not self._stop_event.is_set():
            if self.enabled and self.connection_status == "connected" and self._mqtt_client:
                try:
                    metrics = SystemService.get_all_metrics()
                    payload = {
                        "device_id": self.device_id,
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "metrics": metrics
                    }
                    self._mqtt_client.publish(self.telemetry_topic, json.dumps(payload), qos=1)
                except Exception:
                    pass
            # Wait for interval, checking stop_event periodically
            interval = max(1, self.telemetry_interval)
            for _ in range(int(interval)):
                if self._stop_event.is_set():
                    break
                time.sleep(1)

    def update_settings(self, data: dict):
        self.enabled = data.get("enabled", self.enabled)
        self.broker_host = data.get("broker_host", self.broker_host)
        self.broker_port = int(data.get("broker_port", self.broker_port))
        self.username = data.get("username", self.username)
        self.password = data.get("password", self.password)
        self.device_id = data.get("device_id", self.device_id)
        self.heartbeat_topic = data.get("heartbeat_topic", self.heartbeat_topic)
        self.heartbeat_interval = int(data.get("heartbeat_interval", self.heartbeat_interval))
        self.telemetry_topic = data.get("telemetry_topic", self.telemetry_topic)
        self.telemetry_interval = int(data.get("telemetry_interval", self.telemetry_interval))
        
        self.save_config()
        
        # Hot-restart service to apply changes
        self.stop()
        self.start()
