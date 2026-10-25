"""
Application Configuration for ConnectSign AI Backend.
"""

from typing import List, Union
import json
import os
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "ConnectSign AI Recognition API"
    VERSION: str = "0.2.0"
    API_V1_STR: str = "/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Explicit allowed CORS origins (supports JSON array or comma-separated string)
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://bridge-sign.vercel.app",
    ]

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        default_origins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:4173",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "https://bridge-sign.vercel.app",
        ]

        def _clean(item: str) -> List[str]:
            cleaned = str(item).strip().strip("'\"[]").rstrip("/")
            if not cleaned:
                return []
            results = [cleaned]
            # If scheme was omitted (e.g. 'connect-sign-nine.vercel.app'), add https:// automatically
            if not (cleaned.startswith("http://") or cleaned.startswith("https://")):
                results.append(f"https://{cleaned}")
            return results

        parsed_origins: List[str] = []
        if isinstance(v, str):
            v_str = v.strip().strip("'\"")
            if v_str.startswith("[") and v_str.endswith("]"):
                try:
                    parsed = json.loads(v_str)
                    if isinstance(parsed, list):
                        for item in parsed:
                            parsed_origins.extend(_clean(item))
                except Exception:
                    pass
            if not parsed_origins and v_str:
                for i in v_str.split(","):
                    parsed_origins.extend(_clean(i))
        elif isinstance(v, list):
            for i in v:
                parsed_origins.extend(_clean(i))

        return parsed_origins or default_origins

    # Model configuration
    MODEL_DIR: str = os.getenv(
        "MODEL_DIR",
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "models"),
    )
    UNCERTAINTY_THRESHOLD: float = float(os.getenv("UNCERTAINTY_THRESHOLD", "0.12"))
    MAX_FRAMES: int = int(os.getenv("MAX_FRAMES", "48"))
    MIN_FRAMES: int = 1
    DEVICE: str = "cpu"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
