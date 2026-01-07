import json
import random
import os
import requests

from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="MNB Vizsga Gyakorló API",
    version="1.0",
    description="PSZK vizsgafelkészítő backend"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://vizsgagyakorlo-1.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

QUESTIONS_URL = os.getenv("QUESTIONS_URL")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

if not QUESTIONS_URL:
    raise RuntimeError("QUESTIONS_URL nincs beállítva")

headers = {}
if GITHUB_TOKEN:
    headers["Authorization"] = f"token {GITHUB_TOKEN}"

try:
    resp = requests.get(QUESTIONS_URL, headers=headers, timeout=10)
    resp.raise_for_status()
    QUESTIONS = resp.json()
except Exception as e:
    raise RuntimeError(f"Nem sikerült letölteni a questions.json-t: {e}")



if not isinstance(QUESTIONS, list) or not QUESTIONS:
    raise RuntimeError("A questions.json üres vagy hibás")

QUESTIONS_BY_ID = {q["id"]: q for q in QUESTIONS}
QUESTIONS_BY_SUBJECT = {}

for q in QUESTIONS:
    QUESTIONS_BY_SUBJECT.setdefault(q["subject"], []).append(q)

# ─────────────────────────────────────────────
# SEGÉDFÜGGVÉNYEK
# ─────────────────────────────────────────────

def strip_correct_flag(question: dict) -> dict:
    return {
        "id": question["id"],
        "subject": question["subject"],
        "questionText": question["questionText"],
        "answers": [
            {"key": a["key"], "text": a["text"]}
            for a in question["answers"]
        ]
    }

def correct_key(question: dict) -> str:
    return next(a["key"] for a in question["answers"] if a["correct"])

# ─────────────────────────────────────────────
# ENDPOINTOK
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "message": "MNB vizsga gyakorló backend él 🫡",
        "questions": len(QUESTIONS),
        "subjects": len(QUESTIONS_BY_SUBJECT)
    }

@app.get("/subjects")
def list_subjects():
    return sorted(QUESTIONS_BY_SUBJECT.keys())

@app.get("/practice/{subject}")
def practice_subject(subject: str):
    if subject not in QUESTIONS_BY_SUBJECT:
        raise HTTPException(404, "Nincs ilyen vizsgatárgy")

    q = random.choice(QUESTIONS_BY_SUBJECT[subject])
    return strip_correct_flag(q)

@app.post("/practice/{question_id}/answer")
def answer_practice(question_id: int, selected_key: str):
    q = QUESTIONS_BY_ID.get(question_id)
    if not q:
        raise HTTPException(404, "Nincs ilyen kérdés")

    ck = correct_key(q)

    return {
        "correct": selected_key == ck,
        "correctAnswer": ck
    }

# ─────────────────────────────────────────────
# PRÓBAVIZSGA
# ─────────────────────────────────────────────

@app.get("/exam/start")
def start_exam():
    if len(QUESTIONS) < 60:
        raise HTTPException(400, "Nincs elég kérdés próbavizsgához")

    selected = random.sample(QUESTIONS, 60)

    return {
        "startedAt": datetime.utcnow(),
        "endsAt": datetime.utcnow() + timedelta(minutes=60),
        "questions": [strip_correct_flag(q) for q in selected]
    }

@app.post("/exam/submit")
def submit_exam(answers: dict):
    score = 0

    for qid_str, selected in answers.items():
        q = QUESTIONS_BY_ID.get(int(qid_str))
        if not q:
            continue
        if selected == correct_key(q):
            score += 1

    return {
        "score": score,
        "passed": score >= 45,
        "required": 45,
        "total": 60
    }

# ─────────────────────────────────────────────
# REVIEW – CSAK A 60 KÉRDÉS
# ─────────────────────────────────────────────

@app.post("/exam/review")
def exam_review(answers: dict):
    review = []
    score = 0

    for qid_str, selected in answers.items():
        qid = int(qid_str)
        q = QUESTIONS_BY_ID.get(qid)
        if not q:
            continue

        ck = correct_key(q)
        is_correct = selected == ck
        if is_correct:
            score += 1

        review.append({
            "id": qid,
            "questionText": q["questionText"],
            "answers": [
                {
                    "key": a["key"],
                    "text": a["text"],
                    "correct": a["key"] == ck,
                    "selected": a["key"] == selected
                }
                for a in q["answers"]
            ],
            "userCorrect": is_correct
        })

    return {
        "score": score,
        "passed": score >= 45,
        "total": 60,
        "required": 45,
        "review": review
    }
