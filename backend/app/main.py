from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models.user import User
from app.routers.auth import router as auth_router
from app.models.password_reset import PasswordResetToken
from app.routers import speech
from app.models.learningAttempt import LearningAttempt
from app.routers.learning import router as learning_router
from app.models.userFeedback import UserFeedback
from app.routers.userFeedback import router as feedbackRouter
from app.models.generatedQuestion import GeneratedQuestionRecord

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="IntelliPrep API",
    description="Backend API for the personalised technical interview learning system.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(speech.router)
app.include_router(learning_router)
app.include_router(feedbackRouter)


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

