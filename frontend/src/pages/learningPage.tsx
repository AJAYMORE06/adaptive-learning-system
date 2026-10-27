

import { useEffect, useRef, useState, type FormEvent } from "react";
import "./learningPage.css";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

type Difficulty = "beginner" | "intermediate" | "expert" | "exceptional";

interface LearningQuestion {

  id: number;

  question_number: number;

  question: string;

  topic: string;

  concept: string;

  difficulty: Difficulty;

  // Reference answers and rubrics stay on the backend until assessment completion.

}



interface GenerateQuestionsResponse {

  session_id: string;

  topic: string;

  questions: LearningQuestion[];

}



const API_BASE_URL = "http://localhost:8000";



export default function LearningPage() {

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [recording, setRecording] = useState(false);

  const [transcribing, setTranscribing] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [answer, setAnswer] = useState("");

  const [error, setError] = useState("");

  const [status, setStatus] = useState("Ready to record");

  const [topic, setTopic] = useState("Angular");

  const [questions, setQuestions] = useState<LearningQuestion[]>([]);

  const [sessionId, setSessionId] = useState("");

  const [generating, setGenerating] = useState(false);



  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  const chunksRef = useRef<Blob[]>([]);

  const navigate = useNavigate();

  const currentQuestion = questions[currentQuestionIndex];

  const isLastQuestion =

    questions.length > 0 &&

    currentQuestionIndex === questions.length - 1;

  const location = useLocation();

const {
  topic: selectedTopic,
  autoStart,
} = (location.state ?? {}) as {
  topic?: string;
  autoStart?: boolean;
};

const hasAutoStarted = useRef(false);

useEffect(() => {
  if (selectedTopic) {
    setTopic(selectedTopic);
  }
}, [selectedTopic]);

useEffect(() => {
  if (autoStart && selectedTopic && !hasAutoStarted.current) {
    hasAutoStarted.current = true;
    void generateQuestions(undefined, selectedTopic);
  }
}, [autoStart, selectedTopic]);


  useEffect(() => {

    return () => {

      streamRef.current?.getTracks().forEach((track) => track.stop());

    };

  }, []);



  async function startRecording() {

    setError("");



    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {

      setError("Audio recording is not supported by this browser.");

      return;

    }



    try {

      const stream = await navigator.mediaDevices.getUserMedia({

        audio: true,

      });



      streamRef.current = stream;

      chunksRef.current = [];



      const preferredType = [

        "audio/webm;codecs=opus",

        "audio/webm",

        "audio/mp4",

      ].find((type) => MediaRecorder.isTypeSupported(type));



      const recorder = preferredType

        ? new MediaRecorder(stream, { mimeType: preferredType })

        : new MediaRecorder(stream);



      mediaRecorderRef.current = recorder;



      recorder.ondataavailable = (event) => {

        if (event.data.size > 0) {

          chunksRef.current.push(event.data);

        }

      };



      recorder.onstop = async () => {

        stream.getTracks().forEach((track) => track.stop());

        streamRef.current = null;



        const audioBlob = new Blob(chunksRef.current, {

          type: recorder.mimeType || "audio/webm",

        });



        if (audioBlob.size === 0) {

          setError("No audio was captured. Please try recording again.");

          setStatus("Ready to record");

          return;

        }



        await transcribeAudio(audioBlob);

      };



      recorder.start();

      setRecording(true);

      setStatus("Recording your answer...");

    } catch {

      setError(

        "Unable to access your microphone. Please check your browser permissions."

      );

      setStatus("Ready to record");

    }

  }





async function generateQuestions(
  event?: FormEvent<HTMLFormElement>,
  topicOverride?: string,
) {
  event?.preventDefault();

  const trimmedTopic = (topicOverride ?? topic).trim();



  if (!trimmedTopic || generating) {

    return;

  }



  const token = sessionStorage.getItem("access_token");



  if (!token) {

    navigate("/login");

    return;

  }



  setGenerating(true);

  setError("");



  try {

    const response = await fetch(

      `${API_BASE_URL}/api/learning/generate-questions`,

      {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,

        },

        body: JSON.stringify({ topic: trimmedTopic }),

      },

    );



    const result = await response.json().catch(() => ({}));



    if (response.status === 401) {

      sessionStorage.removeItem("access_token");

      navigate("/login");

      return;

    }



    if (!response.ok) {

      throw new Error(

        result.detail ||

          `Question generation failed (HTTP ${response.status}).`,

      );

    }



    const data = result as GenerateQuestionsResponse;



    if (

      !data.session_id ||

      !Array.isArray(data.questions) ||

      data.questions.length !== 10

    ) {

      throw new Error("The server returned an invalid question set.");

    }



    setQuestions(data.questions);

    setSessionId(data.session_id);

    setCurrentQuestionIndex(0);

    setAnswer("");

    setError("");

    setStatus("Ready to record");

  } catch (err) {

    setError(

      err instanceof TypeError

        ? "Cannot connect to the server. Check that FastAPI is running."

        : err instanceof Error

          ? err.message

          : "Unable to generate questions. Please try again.",

    );

  } finally {

    setGenerating(false);

  }

}





  function stopRecording() {

    const recorder = mediaRecorderRef.current;



    if (recorder && recorder.state !== "inactive") {

      setRecording(false);

      setStatus("Preparing your recording...");

      recorder.stop();

    }

  }



  async function transcribeAudio(audioBlob: Blob) {

    setTranscribing(true);

    setStatus("Transcribing your answer...");

    setError("");



    try {

      const extension = audioBlob.type.includes("mp4") ? "mp4" : "webm";

      const formData = new FormData();



      formData.append("file", audioBlob, `answer.${extension}`);



      const response = await fetch(

        `${API_BASE_URL}/api/speech/transcribe`,

        {

          method: "POST",

          body: formData,

        }

      );



      const result = await response.json();



      if (!response.ok) {

        throw new Error(

          result.detail || "Transcription failed. Please try again."

        );

      }



      setAnswer((previous) =>

        previous

          ? `${previous.trim()} ${result.text}`.trim()

          : result.text

      );

      setStatus("Transcription complete. Review your answer below.");

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "Unable to transcribe the recording."

      );

      setStatus("Transcription failed");

    } finally {

      setTranscribing(false);

      mediaRecorderRef.current = null;

      chunksRef.current = [];

    }

  }



  async function submitAnswer() {

    const trimmedAnswer = answer.trim();



    if (!trimmedAnswer || submitting) {

      return;

    }



    setSubmitting(true);

    setError("");

    setStatus("Saving your answer...");



    try {

      const token = sessionStorage.getItem("access_token");



      if (!token) {

        throw new Error("Your session has expired. Please log in again.");

      }



      const response = await fetch(

        `${API_BASE_URL}/api/learning/attempts`,

        {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

            Authorization: `Bearer ${token}`,

          },

          body: JSON.stringify({

            session_id: sessionId,

            question_id: String(currentQuestion.id),

            question_text: currentQuestion.question,

            answer_text: trimmedAnswer,

            difficulty: currentQuestion.difficulty,

            hint_count: 0,

            hints_used: [],

          }),

        }

      );



      const result = await response.json().catch(() => ({}));



      if (!response.ok) {

        if (response.status === 401) {

          throw new Error(

            "Authentication failed. Please log in again."

          );

        }



        throw new Error(

          result.detail ||

            `Unable to save your answer (HTTP ${response.status}).`

        );

      }



      if (isLastQuestion) {

  navigate(`/report?session_id=${encodeURIComponent(sessionId)}`);

  return;

}

      setAnswer("");

      setCurrentQuestionIndex((previous) => previous + 1);

      setStatus("Answer saved successfully.");

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "Something went wrong while saving your answer."

      );

      setStatus("Answer not saved. Please try again.");

    } finally {

      setSubmitting(false);

    }

  }



  return (

    <main className="learning-page">
<header className="learning-header">

        <div>

          <p className="learning-eyebrow">INTELLIPREP</p>

          <h1>Learning Studio</h1>

          <p>Practise technical interviews in your own words.</p>

        </div>


{questions.length > 0 && (
        <span className="learning-progress">

          Question {currentQuestionIndex + 1} of {questions.length}

        </span>
)}

      </header>
      {questions.length === 0 && (
      <section className="question-card">
        <p className="learning-eyebrow">PERSONALISED PRACTICE</p>
        <p>
          Generating 10 technical interview questions, progressing from
          beginner to exceptional difficulty. This will take a while.
        </p>
        <form onSubmit={generateQuestions}>
          <label htmlFor="learning-topic">Technical stack</label>
          <input
            id="learning-topic"
            type="text"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. Angular, Python, SQL"
            minLength={2}
            maxLength={100}
            required
            disabled={generating}
          />
          {error && (
            <p className="learning-error" role="alert">{error}</p>
          )}
          <button
            type="submit"
            className="submit-answer-button"
            disabled={generating || topic.trim().length < 2}
          >
            {generating ? "Generating questions..." : "Generate 10 questions"}
          </button>
        </form>
      </section>
    )}

      {questions.length > 0 &&
      currentQuestionIndex < questions.length &&
      currentQuestion ? (

        <>

          <section className="question-card">

            <div className="question-meta">

              <span>{currentQuestion.difficulty.toUpperCase()}</span>

              <span>{currentQuestion.topic.toUpperCase()}</span>

            </div>



            <h2>{currentQuestion.question}</h2>



            <p>

              Speak naturally. Your answer will be transcribed into the

              textbox, where you can review and edit it.

            </p>

          </section>



          <div className="learning-workspace">

            <section className="recording-card">

              <div

                className={`microphone-icon ${

                  recording ? "is-recording" : ""

                }`}

              >

                <span aria-hidden="true">🎙</span>

              </div>



              <h2>

                {recording ? "Listening to you..." : "Your turn to speak"}

              </h2>



              <p className="recording-status" aria-live="polite">

                {status}

              </p>



              <div className="recording-actions">

                {!recording ? (

                  <button

                    className="record-button"

                    onClick={startRecording}

                    disabled={transcribing || submitting}

                  >

                    Start recording

                  </button>

                ) : (

                  <button

                    className="stop-button"

                    onClick={stopRecording}

                  >

                    Stop recording

                  </button>

                )}

              </div>



              {transcribing && (

                <p className="transcribing-message">

                  Whisper is processing your audio. This may take a little

                  while.

                </p>

              )}



              {error && (

                <p className="learning-error" role="alert">

                  {error}

                </p>

              )}

            </section>



            <section className="answer-card">

              <div className="answer-heading">

                <div>

                  <h2>Your answer</h2>

                  <p>

                    Edit the transcript if anything was recognised

                    incorrectly.

                  </p>

                </div>



                <span>

                  {answer.trim()

                    ? answer.trim().split(/\s+/).length

                    : 0}{" "}

                  words

                </span>

              </div>



              <textarea

                value={answer}

                onChange={(event) => setAnswer(event.target.value)}

                placeholder="Your spoken answer will appear here..."

                rows={7}

                aria-label="Your transcribed answer"

                disabled={submitting}

              />



              <div className="answer-footer">

                <span>Review your answer before submitting.</span>



                <button

                  className="submit-answer-button"

                  disabled={

                    !answer.trim() ||

                    recording ||

                    transcribing ||

                    submitting

                  }

                  onClick={submitAnswer}

                >

                  {isLastQuestion ? "Submit" : "Next"}

                </button>

              </div>

            </section>

          </div>

        </>

      ) : null}

    </main>

  );

}


