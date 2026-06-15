import os

class Settings:
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey_protectqube_voiceguard_orange_pi")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # Default admin credentials
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    # Default bcrypt hash for "admin123"
    ADMIN_PASSWORD_HASH: str = os.getenv("ADMIN_PASSWORD_HASH", "$2b$12$8Yq9prElz7KsWNVJCMNrguSZqV97huYLcIueffa6yW/zfdBQj7OFG")

settings = Settings()
