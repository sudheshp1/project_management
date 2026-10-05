from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Project Management API")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


static_directory = Path(__file__).parent.parent / "static"
app.mount("/", StaticFiles(directory=static_directory, html=True), name="static")
