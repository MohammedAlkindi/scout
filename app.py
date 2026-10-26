"""Native Vercel FastAPI entrypoint; API paths are preserved without rewrites."""

from server.api import app

__all__ = ["app"]
