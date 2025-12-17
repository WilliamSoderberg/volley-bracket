import os
import secrets
from passlib.context import CryptContext

# Database
DB_PATH = os.getenv("DB_PATH", "./tournaments.db")

# Security
# Run "openssl rand -hex 32" to generate a good key in production
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")

# Auth Context (Argon2)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
ADMIN_HASH = pwd_context.hash(ADMIN_PASSWORD)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)
