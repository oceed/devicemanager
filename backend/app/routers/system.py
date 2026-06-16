from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import subprocess
from typing import Optional
from app.services.system_service import SystemService
from app.services.usb_service import UsbService
from app.services.network_service import NetworkService
from app.routers.auth import get_current_user

from app.services.mqtt_service import MqttService

router = APIRouter(prefix="/api/system", tags=["system"])

class UsbResetRequest(BaseModel):
    path: str

class ServiceControlRequest(BaseModel):
    service_name: str
    action: str

class MqttConfigureRequest(BaseModel):
    enabled: bool
    broker_host: str
    broker_port: int
    username: Optional[str] = ""
    password: Optional[str] = ""
    device_id: str
    heartbeat_topic: str
    heartbeat_interval: int
    telemetry_topic: str
    telemetry_interval: int

@router.get("/metrics")
async def get_metrics(current_user: str = Depends(get_current_user)):
    return SystemService.get_all_metrics()

@router.post("/control")
async def control_system(action: str, current_user: str = Depends(get_current_user)):
    """
    action: 'reboot' or 'shutdown'
    """
    if action not in ("reboot", "shutdown"):
        raise HTTPException(status_code=400, detail="Invalid action. Use 'reboot' or 'shutdown'.")
        
    try:
        if action == "reboot":
            subprocess.Popen(["sudo", "reboot"])
            return {"success": True, "message": "System reboot initiated."}
        elif action == "shutdown":
            subprocess.Popen(["sudo", "poweroff"])
            return {"success": True, "message": "System shutdown initiated."}
    except Exception as e:
        return {"success": False, "message": f"Could not perform action on host: {str(e)}"}

@router.get("/usb")
async def get_usb_devices(current_user: str = Depends(get_current_user)):
    return UsbService.get_devices()

@router.post("/usb/reset")
async def reset_usb_device(req: UsbResetRequest, current_user: str = Depends(get_current_user)):
    res = UsbService.reset_device(req.path)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@router.get("/services")
async def get_services(current_user: str = Depends(get_current_user)):
    return SystemService.get_services()

@router.post("/services/control")
async def control_service(req: ServiceControlRequest, current_user: str = Depends(get_current_user)):
    res = SystemService.control_service(req.service_name, req.action)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@router.get("/multimedia")
async def get_multimedia_devices(current_user: str = Depends(get_current_user)):
    return SystemService.get_multimedia_devices()

@router.get("/modem")
async def get_modem_info(modem_id: Optional[str] = "0", current_user: str = Depends(get_current_user)):
    modems = NetworkService.list_modems()
    if not modems:
        return {"modems": [], "active_modem": None}
    
    active_id = modem_id
    found = any(m["id"] == active_id for m in modems)
    if not found and modems:
        active_id = modems[0]["id"]
        
    active_modem = NetworkService.get_modem_info(active_id)
    return {
        "modems": modems,
        "active_modem": active_modem
    }

@router.get("/portal/status")
async def get_portal_status():
    return SystemService.check_projects_installed()

@router.get("/mqtt")
async def get_mqtt_status(current_user: str = Depends(get_current_user)):
    return MqttService().get_status()

@router.post("/mqtt")
async def configure_mqtt(req: MqttConfigureRequest, current_user: str = Depends(get_current_user)):
    mqtt_svc = MqttService()
    mqtt_svc.update_settings({
        "enabled": req.enabled,
        "broker_host": req.broker_host,
        "broker_port": req.broker_port,
        "username": req.username,
        "password": req.password,
        "device_id": req.device_id,
        "heartbeat_topic": req.heartbeat_topic,
        "heartbeat_interval": req.heartbeat_interval,
        "telemetry_topic": req.telemetry_topic,
        "telemetry_interval": req.telemetry_interval
    })
    return {"success": True, "status": mqtt_svc.get_status()}



