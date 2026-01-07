import { useEffect, useState } from "react";

const API_BASE = "https://vizsgagyakorlo.onrender.com";

const EXAM_QUESTIONS = 60;
const EXAM_TIME = 60 * 60;

function App() {
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState("practice");

  // practice
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [practiceResult, setPracticeResult] = useState(null);

  // exam
  const [examQuestions, setExamQuestions] = useState([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState({});
  const [examFinished, setExamFinished] = useState(false);
  const [examResult, setExamResult] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(EXAM_TIME);

  // ─────────────────────────────
  // SUBJECTEK
  // ─────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/subjects`)
      .then(r => r.json())
      .then(setSubjects);
  }, []);

  // ─────────────────────────────
  // TIMER
  // ─────────────────────────────
  useEffect(() => {
    if (mode !== "exam" || examFinished) return;

    const t = setInterval(() => {
      setTimeLeft(s => {
        if (s <= 1) {
          finishExam();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [mode, examFinished]);

  // ─────────────────────────────
  // PRACTICE
  // ─────────────────────────────
  function loadPractice() {
    fetch(`${API_BASE}/practice/${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(q => {
        setQuestion(q);
        setSelected(null);
        setPracticeResult(null);
      });
  }

  useEffect(() => {
    if (mode === "practice" && subject) loadPractice();
  }, [subject, mode]);

  function answerPractice(key) {
    setSelected(key);
    fetch(
      `${API_BASE}/practice/${question.id}/answer?selected_key=${key}`,
      { method: "POST" }
    )
      .then(r => r.json())
      .then(setPracticeResult);
  }

  // ─────────────────────────────
  // EXAM
  // ─────────────────────────────
  function startExam() {
    resetExamState();
    setMode("exam");

    fetch(`${API_BASE}/exam/start`)
      .then(r => r.json())
      .then(data => {
        setExamQuestions(data.questions);
      });
  }

  function answerExam(key) {
    setExamAnswers(a => ({
      ...a,
      [examQuestions[examIndex].id]: key
    }));
    setSelected(key);
  }

  function nextExam() {
    setSelected(null);
    if (examIndex + 1 >= EXAM_QUESTIONS) {
      finishExam();
    } else {
      setExamIndex(i => i + 1);
    }
  }

  function finishExam() {
    setExamFinished(true);

    fetch(`${API_BASE}/exam/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(examAnswers)
    })
      .then(r => r.json())
      .then(data => {
        setExamResult(data);
        setReviewData(data.review);
      });
  }

  function resetExamState() {
    setExamFinished(false);
    setExamResult(null);
    setReviewData(null);
    setExamQuestions([]);
    setExamIndex(0);
    setExamAnswers({});
    setSelected(null);
    setTimeLeft(EXAM_TIME);
    setQuestion(null);
    setPracticeResult(null);
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const examQuestion = examQuestions[examIndex];

  // ─────────────────────────────
  // UI
  // ─────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#111", color: "#eee", padding: 40 }}>
      <h1>Vizsgagyakorló</h1>

      <button onClick={() => {
        resetExamState();
        setMode("practice");
      }}>
        Gyakorlás
      </button>{" "}
      <button onClick={startExam}>Próbavizsga</button>

      {/* PRACTICE */}
      {mode === "practice" && (
        <>
          <select value={subject} onChange={e => setSubject(e.target.value)}>
            <option value="">-- válassz tárgyat --</option>
            {subjects.map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>

          {question && (
            <>
              <h3>{question.questionText}</h3>
              {question.answers.map(a => (
                <button
                  key={a.key}
                  onClick={() => answerPractice(a.key)}
                  disabled={selected !== null}
                  style={{
                    display: "block",
                    marginBottom: 8,
                    background:
                      practiceResult && a.key === practiceResult.correctAnswer
                        ? "#2e7d32"
                        : selected === a.key
                        ? "#c62828"
                        : "#333",
                    color: "#eee"
                  }}
                >
                  {a.key}) {a.text}
                </button>
              ))}
              {selected && <button onClick={loadPractice}>Következő</button>}
            </>
          )}
        </>
      )}

      {/* EXAM */}
      {mode === "exam" && !examFinished && examQuestion && (
        <>
          <p>⏱ {formatTime(timeLeft)}</p>
          <p>📄 {examIndex + 1} / {EXAM_QUESTIONS}</p>

          <h3>{examQuestion.questionText}</h3>
          {examQuestion.answers.map(a => (
            <button
              key={a.key}
              onClick={() => answerExam(a.key)}
              disabled={selected !== null}
              style={{ display: "block", marginBottom: 8 }}
            >
              {a.key}) {a.text}
            </button>
          ))}
          {selected && <button onClick={nextExam}>Következő</button>}
        </>
      )}

      {/* REVIEW */}
      {examFinished && examResult && reviewData && (
        <>
          <h2>Vége</h2>
          <p>Pont: {examResult.score} / {examResult.total}</p>
          <p>
            Eredmény:{" "}
            <strong style={{ color: examResult.passed ? "lime" : "red" }}>
              {examResult.passed ? "SIKERES" : "SIKERTELEN"}
            </strong>
          </p>

          <hr />
          <h2>Ellenőrzés</h2>

          {reviewData.map(q => (
            <div key={q.id} style={{ marginBottom: 24 }}>
              <strong>{q.questionText}</strong>

              {q.answers.map(a => (
                <div
                  key={a.key}
                  style={{
                    padding: 8,
                    marginTop: 4,
                    background: a.correct
                      ? "#2e7d32"
                      : a.selected
                      ? "#c62828"
                      : "#222"
                  }}
                >
                  {a.key}) {a.text}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default App;
