"""Local /speech server: text in, Skippy WAV out.

Runs the trained v5turbo checkpoints (checkpoints-zh/) over GPT_SoVITS
inference, on this machine's RTX 3080 — no cloud, nothing leaves the laptop.

One fixed reference clip (picked deterministically from clips-zh, 8-9.8 s so
the inference gate's 3-10 s rule always passes) defines Skippy's voice to the
model; changing `ref_clip` is the only "persona" knob the server exposes.
"""

import io
import json
import os
import sys
from pathlib import Path

# v5turbo paths must be set before importing inference_webui.
os.environ.setdefault("version", "v5turbo")

# All heavy/private assets (models, checkpoints, clips) are referenced, never
# shipped: SKIPPY_HOME points at the skippy-voice training checkout.
HOME_DEFAULT = Path.home() / "src" / "skippy-voice.worktrees" / "pipeline-scaffold"
REPO_ROOT = Path(os.environ.get("SKIPPY_HOME", str(HOME_DEFAULT)))
GSV_DIR = REPO_ROOT / "tools" / "GPT-SoVITS"
for path in (str(GSV_DIR), str(GSV_DIR / "GPT_SoVITS")):
    if path not in sys.path:
        sys.path.insert(0, path)

from GPT_SoVITS.inference_webui import change_gpt_weights, change_sovits_weights, get_tts_wav
import GPT_SoVITS.inference_webui as inference_webui


def _en_label() -> str:
    """change_*_weights REBUILDS dict_language (a new object each time),
    so an imported name would read the stale pre-rebuild version forever.
    Read the live attribute per request."""
    return next(label for label, code in inference_webui.dict_language.items() if code == "en")

GPT_CKPT = REPO_ROOT / "checkpoints-zh" / "skippy_zh-e15.ckpt"
SOVITS_CKPT = REPO_ROOT / "checkpoints-zh" / "skippy_zh_e15_s675_l64.pth"
MANIFEST = REPO_ROOT / "data" / "clips-zh" / "manifest.jsonl"

_ref_cache: dict | None = None


def _load_reference() -> dict:
    """The deterministic Zero Hour reference: best-scoring clip ≤ 9.8 s."""
    global _ref_cache
    if _ref_cache is None:
        rows = [json.loads(line) for line in open(MANIFEST) if line.strip()]
        clips = [
            row for row in rows
            if row["type"] == "clip" and row.get("score", 0) == 1.0 and 8 <= row["duration"] <= 9.8
        ]
        if not clips:
            raise RuntimeError("no 8-9.8 s reference candidate in clips-zh manifest")
        chosen = clips[0]
        _ref_cache = {
            "audio": str(REPO_ROOT / "data" / "clips-zh" / chosen["clip"]),
            "text": " ".join(chosen["text"].split()),
        }
    return _ref_cache


def init_models() -> None:
    """Load both legs once, at startup; requests then only render."""
    change_gpt_weights(gpt_path=str(GPT_CKPT))
    change_sovits_weights(sovits_path=str(SOVITS_CKPT))


def synthesize(text: str) -> bytes:
    """Render one line of Skippy speech as WAV bytes."""
    ref = _load_reference()
    result = get_tts_wav(
        ref_wav_path=ref["audio"],
        prompt_text=ref["text"],
        prompt_language=_en_label(),
        text=text,
        text_language=_en_label(),
        top_p=1,
        temperature=1,
    )
    results = list(result)
    if not results:
        raise RuntimeError("inference produced no audio")
    sample_rate, audio = results[-1]
    buffer = io.BytesIO()
    import soundfile as sf

    sf.write(buffer, audio, sample_rate, format="WAV")
    return buffer.getvalue()


def create_app():
    """FastAPI around one Scary-Skippy sampler; import model lazily."""
    from fastapi import FastAPI
    from fastapi.responses import Response
    from pydantic import BaseModel

    class SpeechRequest(BaseModel):
        text: str

    init_models()
    app = FastAPI(title="skippy-voice", version="zh-e15")

    @app.get("/health")
    def health():
        return {"ok": True, "voice": "skippy_zh-e15"}

    @app.post("/speech")
    def speech(body: SpeechRequest):
        wav = synthesize(body.text)
        return Response(content=wav, media_type="audio/wav")

    return app


def run(host: str = "127.0.0.1", port: int = 8911) -> None:
    import uvicorn

    uvicorn.run(create_app(), host=host, port=port, log_level="warning")
