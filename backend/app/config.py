import os

class Settings:
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey_protectqube_voiceguard_orange_pi")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # Default admin credentials
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    # Default bcrypt hash for "admin123"
    ADMIN_PASSWORD_HASH: str = os.getenv("ADMIN_PASSWORD_HASH", "$2b$12$Z0mU6n5xYp4tA9DqT2QYGeB1p9o6r9y0s1l2q3w4e5r6t7y8u9i0o")

settings = Settings()
