import logging
import os
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.whisperService import transcribe_audio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/speech", tags=["Speech"])

MAX_AUDIO_SIZE = 20 * 1024 * 1024  # 20 MB
ALLOWED_AUDIO_TYPES = {
    "audio/webm",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/ogg",
    "audio/flac",
    "audio/aac",
    "application/octet-stream",
}


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    content_type = (file.content_type or "").lower().split(";")[0].strip()

    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio format: {content_type or 'unknown'}",
        )

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=os.path.splitext(file.filename or "recording.webm")[1],
            delete=False,
        ) as temp_file:
            temp_path = temp_file.name
            size = 0

            while chunk := await file.read(1024 * 1024):
                size += len(chunk)

                if size > MAX_AUDIO_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Audio file exceeds the 20 MB limit.",
                    )

                temp_file.write(chunk)

        if size == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded audio file is empty.",
            )

        text = transcribe_audio(temp_path)

        return {"text": text}

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Audio transcription failed")
        raise HTTPException(
            status_code=500,
            detail="Audio transcription failed. Check the backend terminal logs.",
        ) from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

        await file.close()
