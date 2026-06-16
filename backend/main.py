from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, system, network
from app.services.watchdog_service import WatchdogService
from app.services.mqtt_service import MqttService

app = FastAPI(
    title="Orange Pi 5 Pro Device Manager API",
    description="Backend service for hardware monitoring and NetworkManager configuration",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local LAN connectivity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(system.router)
app.include_router(network.router)

@app.on_event("startup")
async def startup_event():
    WatchdogService().start()
    MqttService().start()

@app.on_event("shutdown")
async def shutdown_event():
    WatchdogService().stop()
    MqttService().stop()


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "device": "Orange Pi 5 Pro",
        "system": "Ubuntu / Debian"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8011, reload=True)
