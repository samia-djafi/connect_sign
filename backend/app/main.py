"""
ConnectSign AI Recognition Backend — FastAPI Application Entrypoint.

Provides local-first real-time sign recognition, health telemetry, and phrasebook matching
for Algerian Sign Language (LSA) in healthcare scenarios.
"""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import health, phrases, recognition
from app.core.config import settings
from app.services.inference import inference_service

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s [%(name)s]: %(message)s",
)
logger = logging.getLogger("ConnectSignBackend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Initializes model weights once at process startup.
    """
    logger.info("Initializing %s v%s...", settings.PROJECT_NAME, settings.VERSION)
    success = inference_service.load_model()
    if success:
        logger.info(
            "Model ready: %d vocabulary classes loaded on device '%s'.",
            len(inference_service.target_names),
            settings.DEVICE,
        )
    else:
        logger.warning("Application started with UNLOADED model. State is DEGRADED.")

    yield

    logger.info("Shutting down %s...", settings.PROJECT_NAME)


def create_app() -> FastAPI:
    """Build and configure the FastAPI application instance."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=(
            "Real-time Algerian Sign Language (LSA) recognition API for ConnectSign. "
            "Optimized for CPU inference on Windows (Intel i5, 8GB RAM)."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_origin_regex=r"^https://.*\.vercel\.app$",
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Register API routers
    app.include_router(health.router)
    app.include_router(recognition.router)
    app.include_router(phrases.router)

    # Global exception handler to prevent leaking internal traces
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal server error",
                "detail": "An unexpected error occurred during processing. Please try again.",
            },
        )

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.ENVIRONMENT == "development"),
    )
