from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, system, network

app = FastAPI(
    title="Orange Pi 5 Pro Device Manager API",
    description="Backend service for hardware monitoring and NetworkManager configuration",
    version="1.0.0"
)

# Configure CORS
# In production, when running with network_mode=host or single container setups,
# the frontend and backend might be accessed on the same IP but different ports.
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

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "device": "Orange Pi 5 Pro",
        "system": "Ubuntu / Debian"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)
