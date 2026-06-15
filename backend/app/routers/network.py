from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from app.services.network_service import NetworkService
from app.services.watchdog_service import WatchdogService
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/network", tags=["network"])

# Pydantic Schemas
class WifiConnectRequest(BaseModel):
    ssid: str
    password: Optional[str] = ""

class IpConfigRequest(BaseModel):
    device: str
    method: str = Field(..., description="'auto' for DHCP, 'manual' for Static IP")
    ip: Optional[str] = None
    gateway: Optional[str] = None
    dns: Optional[str] = None

class ApConfigRequest(BaseModel):
    active: bool
    ssid: Optional[str] = "OrangePi-Hotspot"
    password: Optional[str] = "password123"
    interface: Optional[str] = "wlan0"

class VpnImportRequest(BaseModel):
    name: str
    config_content: str
    vpn_type: Optional[str] = "wireguard"

class VpnToggleRequest(BaseModel):
    name: str
    active: bool

class WatchdogConfigureRequest(BaseModel):
    enabled: bool
    ping_target: Optional[str] = "8.8.8.8"
    interval: Optional[int] = 30
    fail_threshold: Optional[int] = 3

class TailscaleToggleRequest(BaseModel):
    active: bool

class InterfaceToggleRequest(BaseModel):
    device: Optional[str] = None
    connection: Optional[str] = None
    radio: Optional[str] = None
    active: bool

@router.get("/interfaces")
async def get_interfaces(current_user: str = Depends(get_current_user)):
    return NetworkService.get_interfaces()

@router.get("/wifi/scan")
async def scan_wifi(current_user: str = Depends(get_current_user)):
    networks = NetworkService.scan_wifi()
    return {"networks": networks}

@router.post("/wifi/connect")
async def connect_wifi(req: WifiConnectRequest, current_user: str = Depends(get_current_user)):
    result = NetworkService.connect_wifi(req.ssid, req.password)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

@router.post("/configure-ip")
async def configure_ip(req: IpConfigRequest, current_user: str = Depends(get_current_user)):
    if req.method not in ("auto", "manual"):
        raise HTTPException(status_code=400, detail="Method must be either 'auto' or 'manual'")
    
    result = NetworkService.configure_ip(
        device=req.device,
        method=req.method,
        ip=req.ip,
        gateway=req.gateway,
        dns=req.dns
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

@router.get("/ap/status")
async def get_ap_status(current_user: str = Depends(get_current_user)):
    return NetworkService.get_ap_status()

@router.post("/ap/configure")
async def configure_ap(req: ApConfigRequest, current_user: str = Depends(get_current_user)):
    result = NetworkService.set_ap_mode(
        active=req.active,
        ssid=req.ssid,
        password=req.password,
        interface=req.interface
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

@router.get("/vpn")
async def get_vpns(current_user: str = Depends(get_current_user)):
    return NetworkService.get_vpn_connections()

@router.post("/vpn/import")
async def import_vpn(req: VpnImportRequest, current_user: str = Depends(get_current_user)):
    result = NetworkService.add_vpn(req.name, req.config_content, req.vpn_type)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

@router.post("/vpn/toggle")
async def toggle_vpn(req: VpnToggleRequest, current_user: str = Depends(get_current_user)):
    result = NetworkService.toggle_vpn(req.name, req.active)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

@router.delete("/vpn/delete/{name}")
async def delete_vpn(name: str, current_user: str = Depends(get_current_user)):
    result = NetworkService.delete_vpn(name)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

# Watchdog endpoints
@router.get("/watchdog/status")
async def get_watchdog_status(current_user: str = Depends(get_current_user)):
    return WatchdogService().get_status()

@router.post("/watchdog/configure")
async def configure_watchdog(req: WatchdogConfigureRequest, current_user: str = Depends(get_current_user)):
    wd = WatchdogService()
    wd.enabled = req.enabled
    if req.ping_target:
        wd.ping_target = req.ping_target
    if req.interval is not None:
        wd.interval = req.interval
    if req.fail_threshold is not None:
        wd.fail_threshold = req.fail_threshold
    wd.save_config()
    return {"success": True, "status": wd.get_status()}

@router.post("/watchdog/clear-logs")
async def clear_watchdog_logs(current_user: str = Depends(get_current_user)):
    wd = WatchdogService()
    wd.clear_logs()
    return {"success": True}

@router.post("/watchdog/trigger")
async def trigger_watchdog(current_user: str = Depends(get_current_user)):
    wd = WatchdogService()
    action = wd.trigger_healing()
    return {"success": True, "action": action}

# Tailscale endpoints
@router.get("/tailscale")
async def get_tailscale(current_user: str = Depends(get_current_user)):
    return NetworkService.get_tailscale_status()

@router.post("/tailscale/toggle")
async def toggle_tailscale(req: TailscaleToggleRequest, current_user: str = Depends(get_current_user)):
    result = NetworkService.toggle_tailscale(req.active)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

# Direct interface / radio toggle
@router.post("/interfaces/toggle")
async def toggle_interface(req: InterfaceToggleRequest, current_user: str = Depends(get_current_user)):
    result = NetworkService.toggle_interface_or_radio(
        active=req.active,
        device=req.device,
        connection=req.connection,
        radio=req.radio
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

@router.post("/wifi/disconnect")
async def disconnect_wifi(current_user: str = Depends(get_current_user)):
    result = NetworkService.disconnect_wifi()
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


