# backend/config.py
import os
from dotenv import load_dotenv

load_dotenv()

# Flask Configuration
FLASK_ENV = os.getenv("FLASK_ENV", "development")
DEBUG = os.getenv("FLASK_DEBUG", "False").lower() == "true"
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

# MySQL Database Configuration (SINGLE SOURCE OF TRUTH)
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "root")
MYSQL_DB = os.getenv("MYSQL_DB", "result_analysis")

SQLALCHEMY_DATABASE_URI = (
    f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}"
    f"@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
)

SQLALCHEMY_TRACK_MODIFICATIONS = False

# CORS Configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

# Maximum allowance for grace marks (adjustable)
GRACE_MAX = int(os.getenv("GRACE_MAX", 15))

# Path to the shared master Excel file used by teachers/admins
MASTER_EXCEL_PATH = os.getenv("MASTER_EXCEL_PATH", os.path.join(os.path.dirname(__file__), "db_exports", "master_marks.xlsx"))
# Expected master sheet name
MASTER_EXCEL_SHEET = os.getenv("MASTER_EXCEL_SHEET", "Marks")

# Optional Config class (USES SAME URI)
class Config:
    SECRET_KEY = SECRET_KEY
    SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI
    SQLALCHEMY_TRACK_MODIFICATIONS = False
