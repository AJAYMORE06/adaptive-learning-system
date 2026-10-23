
from app.services.geminiService import generate_text

result = generate_text(
    "Generate one intermediate-level Angular interview question. "
    "Return only the question, not its answer."
)

print("Connection successful!")
print(result)
