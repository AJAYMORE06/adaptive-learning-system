import os

from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY is missing from backend/.env")

if not model_name:
    raise RuntimeError("GEMINI_MODEL is missing from backend/.env")

client = genai.Client(api_key=api_key)


def generate_text(prompt: str) -> str:
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
    )

    if not response.text:
        raise RuntimeError("Model returned an empty response.")

    return response.text
