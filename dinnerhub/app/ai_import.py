from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field, HttpUrl

router = APIRouter(prefix="/api/ai", tags=["ai-import"])

DATA_DIR = Path(os.getenv("DINNERHUB_DATA_DIR", "/data/dinnerhub"))
SETTINGS_FILE = DATA_DIR / "ai-settings.json"
MAX_VIDEO_BYTES = 250 * 1024 * 1024
DEFAULTS = {
    "provider": "openai",
    "api_base_url": "https://api.openai.com/v1",
    "analysis_model": "gpt-4.1-mini",
    "transcription_model": "gpt-4o-transcribe",
}


class AISettingsInput(BaseModel):
    api_key: str | None = Field(default=None, max_length=500)
    api_base_url: str = Field(default=DEFAULTS["api_base_url"], max_length=500)
    analysis_model: str = Field(default=DEFAULTS["analysis_model"], max_length=120)
    transcription_model: str = Field(default=DEFAULTS["transcription_model"], max_length=120)


class URLImportInput(BaseModel):
    url: HttpUrl


def _settings() -> dict[str, Any]:
    values = dict(DEFAULTS)
    if SETTINGS_FILE.exists():
        try:
            saved = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
            if isinstance(saved, dict):
                values.update({key: value for key, value in saved.items() if value is not None})
        except (OSError, json.JSONDecodeError):
            pass
    return values


def _masked_settings() -> dict[str, Any]:
    values = _settings()
    key = str(values.get("api_key") or "")
    return {
        "provider": "openai",
        "configured": bool(key),
        "api_key_masked": f"••••••••{key[-4:]}" if len(key) >= 4 else ("••••" if key else ""),
        "api_base_url": values["api_base_url"],
        "analysis_model": values["analysis_model"],
        "transcription_model": values["transcription_model"],
    }


def _headers() -> dict[str, str]:
    settings = _settings()
    api_key = str(settings.get("api_key") or "").strip()
    if not api_key:
        raise HTTPException(status_code=409, detail="OpenAI API key is not configured. Open DinnerHub AI settings first.")
    return {"Authorization": f"Bearer {api_key}"}


def _base() -> str:
    return str(_settings()["api_base_url"]).rstrip("/")


@router.get("/settings")
def get_ai_settings() -> dict[str, Any]:
    return _masked_settings()


@router.put("/settings")
def save_ai_settings(payload: AISettingsInput) -> dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    existing = _settings()
    api_key = (payload.api_key or "").strip()
    values = {
        "provider": "openai",
        "api_key": api_key or existing.get("api_key", ""),
        "api_base_url": payload.api_base_url.strip().rstrip("/"),
        "analysis_model": payload.analysis_model.strip(),
        "transcription_model": payload.transcription_model.strip(),
    }
    SETTINGS_FILE.write_text(json.dumps(values, indent=2), encoding="utf-8")
    try:
        SETTINGS_FILE.chmod(0o600)
    except OSError:
        pass
    return _masked_settings()


@router.post("/settings/test")
def test_ai_settings() -> dict[str, Any]:
    try:
        with httpx.Client(timeout=20) as client:
            response = client.get(f"{_base()}/models", headers=_headers())
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500] or f"OpenAI returned HTTP {exc.response.status_code}"
        raise HTTPException(status_code=502, detail=detail) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not connect to the configured OpenAI API: {exc}") from exc
    return {"ok": True, "message": "OpenAI API connection succeeded."}


def _save_upload(upload: UploadFile, destination: Path) -> None:
    total = 0
    with destination.open("wb") as target:
        while chunk := upload.file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_VIDEO_BYTES:
                raise HTTPException(status_code=413, detail="Video is larger than the 250 MB DinnerHub import limit.")
            target.write(chunk)


def _run_ffmpeg(arguments: list[str]) -> None:
    if not shutil.which("ffmpeg"):
        raise HTTPException(status_code=500, detail="FFmpeg is not available in the DinnerHub container.")
    try:
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *arguments],
            check=True,
            capture_output=True,
            timeout=180,
        )
    except subprocess.CalledProcessError as exc:
        error = exc.stderr.decode("utf-8", errors="replace")[-1000:]
        raise HTTPException(status_code=422, detail=f"DinnerHub could not read this video. {error}") from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=422, detail="Video processing took too long.") from exc


def _extract_media(video: Path, workspace: Path) -> tuple[Path | None, list[Path]]:
    audio = workspace / "audio.m4a"
    try:
        _run_ffmpeg(["-i", str(video), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "aac", "-b:a", "64k", str(audio)])
    except HTTPException:
        audio = None

    frame_pattern = workspace / "frame-%02d.jpg"
    _run_ffmpeg([
        "-i", str(video),
        "-vf", "fps=1/8,scale='min(1280,iw)':-2",
        "-frames:v", "8",
        "-q:v", "3",
        str(frame_pattern),
    ])
    frames = sorted(workspace.glob("frame-*.jpg"))
    if not frames:
        raise HTTPException(status_code=422, detail="No usable video frames could be extracted.")
    return audio if audio and audio.exists() and audio.stat().st_size else None, frames


def _transcribe(audio: Path | None) -> str:
    if audio is None:
        return ""
    settings = _settings()
    try:
        with httpx.Client(timeout=180) as client, audio.open("rb") as handle:
            response = client.post(
                f"{_base()}/audio/transcriptions",
                headers=_headers(),
                data={"model": settings["transcription_model"], "response_format": "json"},
                files={"file": (audio.name, handle, "audio/mp4")},
            )
            response.raise_for_status()
            return str(response.json().get("text") or "")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI transcription failed: {exc.response.text[:500]}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI transcription request failed: {exc}") from exc


def _image_data(path: Path) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


RECIPE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "name": {"type": "string"},
        "description": {"type": ["string", "null"]},
        "categories": {"type": "array", "items": {"type": "string"}},
        "cuisine": {"type": ["string", "null"]},
        "prep_minutes": {"type": "integer", "minimum": 0},
        "cook_minutes": {"type": "integer", "minimum": 0},
        "servings": {"type": "number", "exclusiveMinimum": 0},
        "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
        "ingredients": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "quantity": {"type": ["number", "null"]},
                    "unit": {"type": ["string", "null"]},
                    "shopping_category": {"type": "string"},
                    "notes": {"type": ["string", "null"]},
                    "optional": {"type": "boolean"},
                },
                "required": ["name", "quantity", "unit", "shopping_category", "notes", "optional"],
            },
        },
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "instruction": {"type": "string"},
                    "ingredient_names": {"type": "array", "items": {"type": "string"}},
                    "timer_minutes": {"type": ["integer", "null"]},
                    "note": {"type": ["string", "null"]},
                },
                "required": ["instruction", "ingredient_names", "timer_minutes", "note"],
            },
        },
        "food_image_index": {"type": "integer", "minimum": 0},
        "warnings": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "name", "description", "categories", "cuisine", "prep_minutes", "cook_minutes", "servings",
        "difficulty", "ingredients", "steps", "food_image_index", "warnings",
    ],
}


def _response_text(payload: dict[str, Any]) -> str:
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                return str(content["text"])
    raise HTTPException(status_code=502, detail="OpenAI returned no recipe output.")


def _analyse(transcript: str, frames: list[Path]) -> dict[str, Any]:
    settings = _settings()
    content: list[dict[str, Any]] = [{
        "type": "input_text",
        "text": (
            "Extract a practical home-cooking recipe from this cooking video. Use only information supported by the transcript "
            "or visible frames. Do not invent exact quantities that are not stated or clearly shown; use null and add a warning instead. "
            "Link every cooking step to the ingredient names it actually uses. Choose the frame index that best shows the finished meal. "
            f"Transcript:\n{transcript or '[No usable speech was available]'}"
        ),
    }]
    content.extend({"type": "input_image", "image_url": _image_data(frame)} for frame in frames)
    request_payload = {
        "model": settings["analysis_model"],
        "input": [{"role": "user", "content": content}],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "dinnerhub_recipe_import",
                "strict": True,
                "schema": RECIPE_SCHEMA,
            }
        },
    }
    try:
        with httpx.Client(timeout=180) as client:
            response = client.post(
                f"{_base()}/responses",
                headers={**_headers(), "Content-Type": "application/json"},
                json=request_payload,
            )
            response.raise_for_status()
            result = json.loads(_response_text(response.json()))
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI recipe analysis failed: {exc.response.text[:800]}") from exc
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI recipe analysis failed: {exc}") from exc

    image_index = min(max(int(result.get("food_image_index", 0)), 0), len(frames) - 1)
    result["image_data_url"] = _image_data(frames[image_index])
    result["transcript"] = transcript
    result["source_type"] = "video"
    return result


def _process_video(video_path: Path) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="dinnerhub-ai-work-") as temp:
        workspace = Path(temp)
        audio, frames = _extract_media(video_path, workspace)
        transcript = _transcribe(audio)
        return _analyse(transcript, frames)


@router.post("/import/video")
def import_video(file: Annotated[UploadFile, File(...)]) -> dict[str, Any]:
    content_type = (file.content_type or "").lower()
    if content_type and not (content_type.startswith("video/") or content_type == "application/octet-stream"):
        raise HTTPException(status_code=415, detail="Please upload a video file.")
    suffix = Path(file.filename or "recipe-video.mp4").suffix or ".mp4"
    with tempfile.TemporaryDirectory(prefix="dinnerhub-ai-upload-") as temp:
        video_path = Path(temp) / f"source{suffix}"
        _save_upload(file, video_path)
        return _process_video(video_path)


@router.post("/import/url")
def import_video_url(payload: URLImportInput) -> dict[str, Any]:
    url = str(payload.url)
    try:
        with httpx.Client(timeout=60, follow_redirects=True) as client:
            with client.stream("GET", url) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").lower()
                if "video" not in content_type and "octet-stream" not in content_type:
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            "This link did not resolve directly to a video file. Instagram and Facebook page links often require login "
                            "or block automated retrieval. Download the video and use Upload video instead."
                        ),
                    )
                suffix = ".mp4"
                with tempfile.TemporaryDirectory(prefix="dinnerhub-ai-url-") as temp:
                    video_path = Path(temp) / f"source{suffix}"
                    total = 0
                    with video_path.open("wb") as target:
                        for chunk in response.iter_bytes(1024 * 1024):
                            total += len(chunk)
                            if total > MAX_VIDEO_BYTES:
                                raise HTTPException(status_code=413, detail="Remote video exceeds the 250 MB DinnerHub import limit.")
                            target.write(chunk)
                    result = _process_video(video_path)
                    result["source_url"] = url
                    return result
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=422, detail=f"Could not retrieve the video URL: HTTP {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=422, detail=f"Could not retrieve the video URL: {exc}") from exc
