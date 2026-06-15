import os

class Settings:
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey_protectqube_voiceguard_orange_pi")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # Default admin credentials
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    # Default bcrypt hash for "admin123"
    ADMIN_PASSWORD_HASH: str = os.getenv("ADMIN_PASSWORD_HASH", "$2b$12$R.SnbFw5p/s9C4w657N1fuvWb1wB5c6e8t6lZpQvSgY3X/5G8RpeC")

settings = Settings()
