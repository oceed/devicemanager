# Device Manager - API & MQTT Reference Documentation

This document describes the APIs, automated processes, and MQTT payloads utilized by the Device Manager application. It details how sibling applications on the local network or host device can fetch status information, and how telemetry data is reported to the cloud.

---

## 1. System Automation & Operating Modes

| Feature / Service | Mode | Trigger | Description |
| :--- | :--- | :--- | :--- |
| **Smart Watchdog** | Automatic | Periodic (Default: 30s) | Pings a target IP. Toggles network interfaces or restarts system services if connectivity strikes fail. |
| **MQTT Heartbeat** | Automatic | Periodic (Default: 30s) | Publishes device status pings to the MQTT broker. |
| **MQTT Telemetry** | Automatic | Periodic (Default: 60s) | Aggregates system metrics (CPU, RAM, Disk, NPU, Temps) and publishes them to the broker. |
| **Service Control** | Manual | User Action / API POST | Starts, stops, or restarts systemd processes on the host. |
| **System Control** | Manual | User Action / API POST | Triggers host machine reboot or shutdown. |
| **USB Port Reset** | Manual | User Action / API POST | Resets specific USB device buses to clear hardware errors. |

---

## 2. Local REST API Endpoints
All API endpoints run on **Port 8011** (Backend service) and require a JWT token in the headers as `Authorization: Bearer <token>` (except public endpoints).

### 2.1. Public / Unauthorized Endpoints

#### `GET /api/system/portal/status`
- **Description**: Checks whether sibling projects (`protectqube-ai`, `voiceguard`) are installed on the filesystem and running (listening on their standard ports).
- **Trigger**: Automatic / Polling by Landing Portal (Port 80).
- **Response Payload Example (`application/json`)**:
```json
{
  "protectqube": {
    "installed": true,
    "running": true
  },
  "voiceguard": {
    "installed": true,
    "running": false
  },
  "devicemanager": {
    "installed": true,
    "running": true
  }
}
```

#### `GET /api/health`
- **Description**: Simple health status of the device-manager service.
- **Response Payload Example (`application/json`)**:
```json
{
  "status": "healthy",
  "device": "Orange Pi 5 Pro",
  "system": "Ubuntu / Debian"
}
```

---

### 2.2. Authorized / JWT Authenticated Endpoints
Must include header: `Authorization: Bearer <token>`

#### `GET /api/system/metrics`
- **Description**: Returns complete hardware utilization statistics, temperatures, and Rockchip NPU workloads.
- **Response Payload Example (`application/json`)**:
```json
{
  "timestamp": 1781682605.123,
  "uptime": 14520.5,
  "cpu": {
    "percent": 8.4,
    "cores_percent": [12.0, 5.5, 9.2, 7.0],
    "count": 4,
    "frequency_mhz": {
      "current": 1800.0,
      "max": 2400.0
    }
  },
  "memory": {
    "total_gb": 15.54,
    "used_gb": 3.42,
    "free_gb": 12.12,
    "percent": 22.0
  },
  "disk": {
    "total_gb": 118.2,
    "used_gb": 15.8,
    "free_gb": 102.4,
    "percent": 13.4
  },
  "temperatures": {
    "cpu-thermal": 45.8,
    "gpu-thermal": 41.2,
    "npu-thermal": 40.5
  },
  "npu": {
    "supported": true,
    "cores": {
      "Core0": 15,
      "Core1": 0,
      "Core2": 5
    },
    "average": 6.7
  }
}
```

#### `POST /api/system/control`
- **Description**: Initiates a system power action on the host.
- **Query Parameter**: `action` (string, must be `"reboot"` or `"shutdown"`)
- **Response Payload Example (`application/json`)**:
```json
{
  "success": true,
  "message": "System reboot initiated."
}
```

#### `GET /api/system/services`
- **Description**: Returns running state of mapped host systemd services.
- **Response Payload Example (`application/json`)**:
```json
[
  {
    "name": "NetworkManager",
    "status": "active"
  },
  {
    "name": "ModemManager",
    "status": "inactive"
  },
  {
    "name": "voiceguard",
    "status": "active"
  },
  {
    "name": "protectqube",
    "status": "not-installed"
  }
]
```

#### `POST /api/system/services/control`
- **Description**: Trigger systemctl actions on whitelisted services.
- **Request Body**:
```json
{
  "service_name": "voiceguard",
  "action": "restart"
}
```
- **Response Payload Example (`application/json`)**:
```json
{
  "success": true,
  "message": "Successfully performed 'restart' on service 'voiceguard'."
}
```

#### `GET /api/system/usb`
- **Description**: Lists connected USB hardware devices.
- **Response Payload Example (`application/json`)**:
```json
[
  {
    "bus": "001",
    "device": "002",
    "id": "1a86:7523",
    "name": "QinHeng Electronics CH340 serial converter",
    "path": "/sys/bus/usb/devices/1-1.3"
  }
]
```

#### `POST /api/system/usb/reset`
- **Description**: Power cycle/reset a specific USB path.
- **Request Body**:
```json
{
  "path": "/sys/bus/usb/devices/1-1.3"
}
```
- **Response Payload Example (`application/json`)**:
```json
{
  "success": true,
  "message": "USB port /sys/bus/usb/devices/1-1.3 reset successfully."
}
```

#### `GET /api/system/mqtt`
- **Description**: Gets the current MQTT broker connection parameters and status.
- **Response Payload Example (`application/json`)**:
```json
{
  "enabled": true,
  "broker_host": "192.168.1.100",
  "broker_port": 1883,
  "username": "opi_node",
  "password": "secretpassword",
  "device_id": "orange-pi-edge-01",
  "heartbeat_topic": "device/orange-pi-edge-01/heartbeat",
  "heartbeat_interval": 30,
  "telemetry_topic": "device/orange-pi-edge-01/telemetry",
  "telemetry_interval": 60,
  "connection_status": "connected",
  "error_message": null
}
```

#### `POST /api/system/mqtt`
- **Description**: Save settings, write `mqtt_config.json`, and dynamically restart the background MQTT threads.
- **Request Body**: (Same format as fields in GET endpoint)
- **Response Payload Example (`application/json`)**:
```json
{
  "success": true,
  "status": {
    "enabled": true,
    "broker_host": "192.168.1.100",
    "broker_port": 1883,
    "username": "opi_node",
    "password": "secretpassword",
    "device_id": "orange-pi-edge-01",
    "heartbeat_topic": "device/orange-pi-edge-01/heartbeat",
    "heartbeat_interval": 30,
    "telemetry_topic": "device/orange-pi-edge-01/telemetry",
    "telemetry_interval": 60,
    "connection_status": "connecting",
    "error_message": null
  }
}
```

---

## 3. MQTT Payload & Topics (Outward Export)

These telemetry topics are automatically published from the device to the configured broker.

### 3.1. Heartbeat Event
- **Topic**: `device/{device_id}/heartbeat`
- **Interval**: Configurable (Default: 30 seconds)
- **JSON Payload Format**:
```json
{
  "device_id": "orange-pi-edge-01",
  "timestamp": "2026-06-16T11:42:00.123Z",
  "status": "online",
  "uptime_seconds": 14520
}
```

### 3.2. Telemetry Event
- **Topic**: `device/{device_id}/telemetry`
- **Interval**: Configurable (Default: 60 seconds)
- **JSON Payload Format**:
```json
{
  "device_id": "orange-pi-edge-01",
  "timestamp": "2026-06-16T11:42:30.123Z",
  "metrics": {
    "timestamp": 1781682605.123,
    "uptime": 14520.5,
    "cpu": {
      "percent": 8.4,
      "cores_percent": [12.0, 5.5, 9.2, 7.0],
      "count": 4,
      "frequency_mhz": {
        "current": 1800.0,
        "max": 2400.0
      }
    },
    "memory": {
      "total_gb": 15.54,
      "used_gb": 3.42,
      "free_gb": 12.12,
      "percent": 22.0
    },
    "disk": {
      "total_gb": 118.2,
      "used_gb": 15.8,
      "free_gb": 102.4,
      "percent": 13.4
    },
    "temperatures": {
      "cpu-thermal": 45.8,
      "gpu-thermal": 41.2,
      "npu-thermal": 40.5
    },
    "npu": {
      "supported": true,
      "cores": {
        "Core0": 15,
        "Core1": 0,
        "Core2": 5
      },
      "average": 6.7
    }
  }
}
```
