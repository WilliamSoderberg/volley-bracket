import json
import math
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from passlib.context import CryptContext
from starlette.middleware.sessions import SessionMiddleware
import uvicorn

# --- CONFIGURATION ---
DB_PATH = os.getenv("DB_PATH", "./tournaments.db")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
# In production, use a secure secret key!
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))

# CHANGED: Switch from "bcrypt" to "argon2"
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
ADMIN_HASH = pwd_context.hash(os.getenv("ADMIN_PASSWORD", "admin"))

app = FastAPI(title="VolleyManager API")

# Allow React frontend to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session middleware for simple auth persistence
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)


# --- DATABASE ---
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tournaments (id TEXT PRIMARY KEY, data TEXT)"
    )
    conn.commit()
    conn.close()


init_db()


# --- PYDANTIC MODELS (Type Safety) ---
class SetResult(BaseModel):
    p1: int
    p2: int


class Match(BaseModel):
    id: str
    bracket: str
    round: int
    number: Optional[int] = None
    p1: Optional[str] = None
    p2: Optional[str] = None
    winner: Optional[str] = None
    # Dependency Graph
    source_p1: Optional[str] = None
    source_p2: Optional[str] = None
    source_p1_type: Optional[str] = None
    source_p2_type: Optional[str] = None
    next_win: Optional[str] = None
    next_loss: Optional[str] = None
    # Score & Status
    sets: List[SetResult] = []
    p1_sets: int = 0
    p2_sets: int = 0
    court: Optional[str] = None
    time: Optional[str] = None
    timestamp: Optional[str] = None
    status: str = "Pending"
    p1_label: str = "TBD"
    p2_label: str = "TBD"
    criticality: int = 0


class TournamentData(BaseModel):
    id: str
    name: str
    code: str
    type: str
    start_time: str
    match_duration: int
    teams: List[str]
    courts: List[str]
    date: str
    matches: List[Match] = []


class TournamentCreate(BaseModel):
    name: str
    date: str
    code: str
    type: Literal["single", "double"]
    courts: str  # Comma separated string from frontend
    duration: int
    start_time: str
    teams: str  # Newline separated string from frontend


class ScoreReport(BaseModel):
    id: str
    sets: Optional[List[SetResult]] = None
    code: Optional[str] = None
    clear: bool = False


class LoginRequest(BaseModel):
    username: str
    password: str


# --- BUSINESS LOGIC (Migrated) ---
def get_seeded_positions(num_slots, teams):
    seeds = [1, 2]
    while len(seeds) < num_slots:
        next_seeds = []
        for s in seeds:
            next_seeds.append(s)
            next_seeds.append(2 * len(seeds) + 1 - s)
        seeds = next_seeds
    return [teams[s - 1] if s <= len(teams) else "BYE" for s in seeds]


def generate_structure(teams: List[str], type: str = "double") -> List[Match]:
    count = len(teams)
    if count < 2:
        return []
    power = math.ceil(math.log2(count)) if count > 0 else 1
    size = 2**power
    seeded_teams = get_seeded_positions(size, teams)
    matches = []
    match_counter = 1

    def create_match_obj(bracket, round_n):
        nonlocal match_counter
        m = Match(id=str(match_counter), bracket=bracket, round=round_n)
        match_counter += 1
        matches.append(m)
        return m

    # Winners Bracket
    wb_rounds = power
    wb_matches = {r: [] for r in range(1, wb_rounds + 1)}
    for r in range(1, wb_rounds + 1):
        for _ in range(size // (2**r)):
            wb_matches[r].append(create_match_obj("winners", r))

    for r in range(1, wb_rounds):
        for i, m in enumerate(wb_matches[r]):
            target = wb_matches[r + 1][i // 2]
            m.next_win = target.id
            if i % 2 == 0:
                target.source_p1 = m.id
                target.source_p1_type = "winner"
            else:
                target.source_p2 = m.id
                target.source_p2_type = "winner"

    for i, m in enumerate(wb_matches[1]):
        m.p1 = seeded_teams[i * 2]
        m.p2 = seeded_teams[i * 2 + 1]

    # Losers Bracket
    if type == "double" and size >= 4:
        lb_rounds = (wb_rounds - 1) * 2
        lb_matches = {r: [] for r in range(1, lb_rounds + 1)}
        current_count = size // 4
        for r in range(1, lb_rounds + 1):
            for _ in range(current_count):
                lb_matches[r].append(create_match_obj("losers", r))
            if r % 2 == 0:
                current_count //= 2

        for r in range(1, lb_rounds):
            for i, m in enumerate(lb_matches[r]):
                target = (
                    lb_matches[r + 1][i] if r % 2 != 0 else lb_matches[r + 1][i // 2]
                )
                m.next_win = target.id
                if r % 2 != 0:
                    target.source_p1 = m.id
                    target.source_p1_type = "winner"
                else:
                    if i % 2 == 0:
                        target.source_p1 = m.id
                        target.source_p1_type = "winner"
                    else:
                        target.source_p2 = m.id
                        target.source_p2_type = "winner"

        for r in range(1, wb_rounds):
            drop_round = 1 if r == 1 else (r - 1) * 2
            wb_layer = wb_matches[r]
            lb_layer = lb_matches[drop_round]
            for i, wb_m in enumerate(wb_layer):
                target = (
                    lb_layer[i // 2]
                    if r == 1
                    else (lb_layer[i] if i < len(lb_layer) else lb_layer[-1])
                )
                slot = "p1" if (r == 1 and i % 2 == 0) else "p2"
                wb_m.next_loss = target.id
                if slot == "p1":
                    target.source_p1 = wb_m.id
                    target.source_p1_type = "loser"
                else:
                    target.source_p2 = wb_m.id
                    target.source_p2_type = "loser"

        wb_final = wb_matches[wb_rounds][0]
        lb_final = lb_matches[lb_rounds][0]
        wb_final.next_loss = lb_final.id
        lb_final.source_p2 = wb_final.id
        lb_final.source_p2_type = "loser"
        final = create_match_obj("finals", 1)
        wb_final.next_win = final.id
        lb_final.next_win = final.id
        final.source_p1 = wb_final.id
        final.source_p1_type = "winner"
        final.source_p2 = lb_final.id
        final.source_p2_type = "winner"

    return matches


def refresh_bracket(t_obj: TournamentData):
    matches_map = {m.id: m for m in t_obj.matches}
    for _ in range(20):  # Resolve propagation
        for m in t_obj.matches:

            def resolve(src_id, type):
                if not src_id or src_id not in matches_map:
                    return None
                src = matches_map[src_id]
                if type == "winner":
                    return src.winner
                if type == "loser":
                    return (
                        "BYE"
                        if src.winner == "BYE"
                        else (
                            (src.p1 if src.winner == src.p2 else src.p2)
                            if src.winner
                            else None
                        )
                    )
                return None

            if m.source_p1:
                m.p1 = resolve(m.source_p1, m.source_p1_type)
            if m.source_p2:
                m.p2 = resolve(m.source_p2, m.source_p2_type)

            if m.status == "Finished" and m.winner != "BYE":
                if not m.p1 or not m.p2 or (m.winner != m.p1 and m.winner != m.p2):
                    m.winner = None
                    m.status = "Pending"
                    m.sets = []
                    m.p1_sets = 0
                    m.p2_sets = 0

            if not m.winner and (m.p1 == "BYE" or m.p2 == "BYE"):
                m.winner = (
                    "BYE"
                    if (m.p1 == "BYE" and m.p2 == "BYE")
                    else (m.p2 if m.p1 == "BYE" else m.p1)
                )
                m.status = "Finished"

    # Numbering & Labels
    display_counter = 1
    sorted_matches = sorted(t_obj.matches, key=lambda x: int(x.id))
    for m in sorted_matches:
        if m.winner == "BYE" or m.p1 == "BYE" or m.p2 == "BYE":
            m.number = None
        else:
            m.number = display_counter
            display_counter += 1

    def get_label(src_id, type, depth=0):
        if not src_id or src_id not in matches_map or depth > 10:
            return "TBD"
        src = matches_map[src_id]
        if src.number:
            return f"{'Winner' if type == 'winner' else 'Loser'} of #{src.number}"
        if type == "winner":
            return (
                get_label(src.source_p1, src.source_p1_type, depth + 1)
                if src.p2 == "BYE"
                else get_label(src.source_p2, src.source_p2_type, depth + 1)
            )
        return "BYE"

    for m in t_obj.matches:
        m.p1_label = get_label(m.source_p1, m.source_p1_type)
        m.p2_label = get_label(m.source_p2, m.source_p2_type)


def update_schedule(t_obj: TournamentData):
    # Critical path calc
    match_map = {m.id: m for m in t_obj.matches}
    depth_cache = {}

    def get_depth(mid):
        if mid not in match_map:
            return 0
        if mid in depth_cache:
            return depth_cache[mid]
        m = match_map[mid]
        d = 1 + max(
            get_depth(m.next_win) if m.next_win else 0,
            get_depth(m.next_loss) if m.next_loss else 0,
        )
        depth_cache[mid] = d
        return d

    for m in t_obj.matches:
        m.criticality = get_depth(m.id)

    # Scheduler
    base = datetime.now().replace(second=0, microsecond=0)
    sh, sm = map(int, t_obj.start_time.split(":"))
    start = base.replace(hour=sh, minute=sm)
    duration = t_obj.match_duration
    finish_times = {}
    court_timers = {c: start for c in t_obj.courts}
    unscheduled = []

    for m in t_obj.matches:
        if m.winner == "BYE" or m.p1 == "BYE" or m.p2 == "BYE":
            finish_times[m.id] = start
            m.status = "Finished"
        elif m.status == "Finished":
            fin = start + timedelta(minutes=duration)
            if m.timestamp:
                try:
                    fin = datetime.fromisoformat(m.timestamp) + timedelta(
                        minutes=duration
                    )
                except:
                    pass
            finish_times[m.id] = fin
        else:
            m.time = None
            m.timestamp = None
            m.court = None
            m.status = "Pending"
            unscheduled.append(m)

    # Sync timers
    for m in t_obj.matches:
        if m.status == "Finished" and m.court in court_timers:
            fin = finish_times.get(m.id)
            if fin and fin > court_timers[m.court]:
                court_timers[m.court] = fin

    loop = len(t_obj.matches) * 2
    while unscheduled and loop > 0:
        loop -= 1
        best_court = min(court_timers, key=court_timers.get)  # type: ignore
        current = court_timers[best_court]

        ready = []
        for m in unscheduled:
            p1_r = finish_times.get(m.source_p1, start) if m.source_p1 else start
            p2_r = finish_times.get(m.source_p2, start) if m.source_p2 else start
            if max(p1_r, p2_r) <= current:
                ready.append(m)

        if ready:
            ready.sort(key=lambda x: (-x.criticality, x.round))
            cand = ready[0]
            cand.court = best_court
            cand.time = current.strftime("%H:%M")
            cand.timestamp = current.isoformat()
            cand.status = "Scheduled"
            fin = current + timedelta(minutes=duration)
            finish_times[cand.id] = fin
            court_timers[best_court] = fin
            unscheduled.remove(cand)
        else:
            # Fast forward
            next_wake = None
            for m in unscheduled:
                p1_r = finish_times.get(m.source_p1, start) if m.source_p1 else start
                p2_r = finish_times.get(m.source_p2, start) if m.source_p2 else start
                r = max(p1_r, p2_r)
                if r > current:
                    if next_wake is None or r < next_wake:
                        next_wake = r
            if next_wake:
                court_timers[best_court] = next_wake
            else:
                break


# --- ENDPOINTS ---


@app.get("/api/check-auth")
def check_auth(request: Request):
    return {"is_admin": request.session.get("is_admin", False)}


@app.post("/api/login")
def login(creds: LoginRequest, request: Request):
    if creds.username == ADMIN_USER and pwd_context.verify(creds.password, ADMIN_HASH):
        request.session["is_admin"] = True
        return {"status": "success"}
    raise HTTPException(status_code=401, detail="Invalid credentials")


@app.post("/api/logout")
def logout(request: Request):
    request.session.pop("is_admin", None)
    return {"status": "success"}


@app.get("/api/tournaments")
def list_tournaments(db=Depends(get_db)):
    rows = db.execute("SELECT * FROM tournaments").fetchall()
    tournaments = {row["id"]: json.loads(row["data"]) for row in rows}

    today = datetime.now().strftime("%Y-%m-%d")
    live = {k: v for k, v in tournaments.items() if v.get("date") == today}
    future = {
        k: v for k, v in tournaments.items() if v.get("date", "9999-99-99") > today
    }
    past = {
        k: v for k, v in tournaments.items() if v.get("date") and v.get("date") < today
    }

    return {"live": live, "future": future, "past": past, "all": tournaments}


@app.get("/api/t/{id}")
def get_tournament_data(id: str, db=Depends(get_db)):
    row = db.execute("SELECT data FROM tournaments WHERE id = ?", (id,)).fetchone()
    if not row:
        raise HTTPException(404, "Tournament not found")
    t = TournamentData(**json.loads(row["data"]))

    # Sort schedule
    schedule = sorted(
        [m for m in t.matches if m.number and m.time],
        key=lambda x: (x.timestamp or "", x.court or ""),
    )
    return {"tournament": t, "schedule": schedule}


@app.post("/create")
def create_tournament(data: TournamentCreate, request: Request, db=Depends(get_db)):
    if not request.session.get("is_admin"):
        raise HTTPException(403, "Unauthorized")

    teams_list = [t.strip() for t in data.teams.split("\n") if t.strip()]
    if len(teams_list) < 2:
        raise HTTPException(400, "At least 2 teams required")

    courts_list = [c.strip() for c in data.courts.split(",") if c.strip()]
    t_id = str(uuid.uuid4())[:8]

    t = TournamentData(
        id=t_id,
        name=data.name,
        code=data.code,
        type=data.type,
        start_time=data.start_time,
        match_duration=data.duration,
        teams=teams_list,
        courts=courts_list,
        date=data.date,
        matches=generate_structure(teams_list, data.type),
    )
    refresh_bracket(t)
    update_schedule(t)

    db.execute("INSERT INTO tournaments (id, data) VALUES (?, ?)", (t.id, t.json()))
    db.commit()
    return {"status": "ok", "id": t.id}


@app.post("/api/settings/{id}")
def update_settings(
    id: str, data: TournamentCreate, request: Request, db=Depends(get_db)
):
    if not request.session.get("is_admin"):
        raise HTTPException(403, "Unauthorized")

    row = db.execute("SELECT data FROM tournaments WHERE id = ?", (id,)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    t = TournamentData(**json.loads(row["data"]))

    new_teams = [t.strip() for t in data.teams.split("\n") if t.strip()]
    if len(new_teams) < 2:
        raise HTTPException(400, "At least 2 teams required")

    structure_changed = False
    if t.type != data.type or t.teams != new_teams:
        t.type = data.type
        t.teams = new_teams
        structure_changed = True

    t.name = data.name
    t.code = data.code
    t.date = data.date
    t.start_time = data.start_time
    t.match_duration = data.duration
    t.courts = [c.strip() for c in data.courts.split(",") if c.strip()]

    if structure_changed:
        t.matches = generate_structure(t.teams, t.type)
        refresh_bracket(t)

    update_schedule(t)
    db.execute("UPDATE tournaments SET data = ? WHERE id = ?", (t.json(), id))
    db.commit()
    return {"status": "ok"}


@app.post("/api/report/{id}")
def report_score(id: str, report: ScoreReport, request: Request, db=Depends(get_db)):
    row = db.execute("SELECT data FROM tournaments WHERE id = ?", (id,)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    t = TournamentData(**json.loads(row["data"]))

    if str(report.code).strip() != str(t.code).strip() and not request.session.get(
        "is_admin"
    ):
        raise HTTPException(403, "Invalid Code")

    match = next((m for m in t.matches if m.id == report.id), None)
    if not match:
        raise HTTPException(404, "Match not found")

    if report.clear:
        match.winner = None
        match.sets = []
        match.p1_sets = 0
        match.p2_sets = 0
        match.status = "Pending"
    else:
        if not match.p1 or not match.p2:
            raise HTTPException(400, "Teams not ready")
        match.sets = report.sets  # type: ignore
        p1s = 0
        p2s = 0
        p1_pts = 0
        p2_pts = 0
        for s in match.sets:
            p1_pts += s.p1
            p2_pts += s.p2
            if s.p1 > s.p2:
                p1s += 1
            elif s.p2 > s.p1:
                p2s += 1

        match.p1_sets = p1s
        match.p2_sets = p2s

        if p1s > p2s:
            match.winner = match.p1
        elif p2s > p1s:
            match.winner = match.p2
        else:
            # Tie breaker by points
            if p1_pts > p2_pts:
                match.winner = match.p1
            elif p2_pts > p1_pts:
                match.winner = match.p2
            else:
                raise HTTPException(400, "Match is deadlocked (Sets and Points tied)")
        match.status = "Finished"

    refresh_bracket(t)
    update_schedule(t)
    db.execute("UPDATE tournaments SET data = ? WHERE id = ?", (t.json(), id))
    db.commit()
    return {"status": "ok"}


@app.post("/api/delete/{id}")
def delete_tournament(id: str, request: Request, db=Depends(get_db)):
    if not request.session.get("is_admin"):
        raise HTTPException(403, "Unauthorized")
    db.execute("DELETE FROM tournaments WHERE id = ?", (id,))
    db.commit()
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
