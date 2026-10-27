import os
import shutil

import whisper

_model = None


def get_whisper_model():
    global _model

    if _model is None:
        _model = whisper.load_model("base")

    return _model


ffmpeg_path = "/opt/homebrew/bin"
os.environ["PATH"] = ffmpeg_path + os.pathsep + os.environ.get("PATH", "")

if shutil.which("ffmpeg") is None:
    raise RuntimeError("FFmpeg executable not found at /opt/homebrew/bin/ffmpeg")


def transcribe_audio(audio_path: str) -> str:
    ffmpeg_path = "/opt/homebrew/bin"
    os.environ["PATH"] = ffmpeg_path + os.pathsep + os.environ.get("PATH", "")

    if shutil.which("ffmpeg") is None:
        raise RuntimeError("FFmpeg executable not found")

    model = get_whisper_model()
    result = model.transcribe(audio_path, fp16=False)
    return result["text"].strip()
