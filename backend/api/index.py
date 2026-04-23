"""
Vercel serverless entry point.

Vercel looks for `api/index.py` and expects a `handler` callable.
Mangum wraps the FastAPI ASGI app so it can be invoked as an AWS Lambda /
Vercel serverless function.
"""

import sys
import os

# Ensure the backend directory is on sys.path so `app.*` imports resolve.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mangum import Mangum
from app.main import app

handler = Mangum(app, lifespan="auto")
