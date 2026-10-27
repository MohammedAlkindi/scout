"""Exercise the production entrypoint, not just the local development mount."""
import os
from pathlib import Path
import subprocess
import sys


def test_production_entrypoint_serves_built_browser_modules():
    if not Path("public/assets/main.js").exists():
        # CI's initial Python pass precedes the frontend build. The postbuild
        # and browser passes run the asset check after compilation.
        return
    script = """
from fastapi.testclient import TestClient
from app import app
response = TestClient(app).get('/assets/main.js')
assert response.status_code == 200, response.text
assert 'fetchRecommendation' in response.text
"""
    subprocess.run([sys.executable, "-c", script], env={**os.environ, "VERCEL": "1"}, check=True)
