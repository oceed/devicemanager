from fastapi import APIRouter, Depends, HTTPException
import subprocess
from app.services.system_service import SystemService
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/system", tags=["system"])

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
        # Check if running in docker and if system control is possible
        # Usually requires dbus or host system access, or sudo permissions inside container
        # Since this is a system utility, we execute reboot/shutdown command.
        if action == "reboot":
            # Running with nohup to allow connection to close before rebooting
            subprocess.Popen(["sudo", "reboot"])
            return {"success": True, "message": "System reboot initiated."}
        elif action == "shutdown":
            subprocess.Popen(["sudo", "poweroff"])
            return {"success": True, "message": "System shutdown initiated."}
    except Exception as e:
        # Gracefully handle dev environment where sudo reboot fails
        return {"success": False, "message": f"Could not perform action on host: {str(e)}"}
