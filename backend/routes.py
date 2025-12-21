import json
import uuid
import datetime
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.security import OAuth2PasswordRequestForm
from database import get_db
from models import TournamentData, TournamentCreate, ScoreReport
from config import ADMIN_USER, ADMIN_HASH, verify_password, ACCESS_TOKEN_EXPIRE_MINUTES
from auth import create_access_token, get_current_user
from websocket_manager import manager
import logic

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.post("/auth/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    if form_data.username == ADMIN_USER and verify_password(
        form_data.password, ADMIN_HASH
    ):
        access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": form_data.username}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
    )


@router.get("/auth/check")
async def check_auth(user: str = Depends(get_current_user)):
    return {"is_admin": True, "user": user}


@router.get("/tournaments")
def list_tournaments(db=Depends(get_db)):
    rows = db.execute("SELECT id, data FROM tournaments").fetchall()
    tournaments = {}
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    for row in rows:
        try:
            full = json.loads(row["data"])
            tournaments[row["id"]] = {
                "id": full["id"],
                "name": full.get("name", "Unknown"),
                "date": full.get("date", ""),
                "start_time": full.get("start_time", ""),
                "type": full.get("type", "double"),
                "team_count": len(full.get("teams", [])),
                "court_count": len(full.get("courts", [])),
            }
        except:
            continue
    return {
        "live": {k: v for k, v in tournaments.items() if v.get("date") == today},
        "future": {k: v for k, v in tournaments.items() if v.get("date", "") > today},
        "past": {k: v for k, v in tournaments.items() if v.get("date", "") < today},
        "all": tournaments,
    }


@router.post("/tournaments")
async def create_tournament(
    data: TournamentCreate, db=Depends(get_db), user: str = Depends(get_current_user)
):
    teams_list = [t.strip() for t in data.teams.split("\n") if t.strip()]
    t_id = str(uuid.uuid4())[:8]
    t = TournamentData(
        id=t_id,
        name=data.name,
        code=data.code,
        type=data.type,
        start_time=data.start_time,
        match_duration=data.duration,
        teams=teams_list,
        courts=[c.strip() for c in data.courts.split(",") if c.strip()],
        date=data.date,
        matches=logic.generate_structure(teams_list, data.type),
    )
    logic.refresh_bracket(t)
    logic.update_schedule(t)
    db.execute("INSERT INTO tournaments (id, data) VALUES (?, ?)", (t.id, t.json()))
    db.commit()
    await manager.broadcast({"type": "dashboard_update"})
    return {"status": "ok", "id": t.id}


@router.get("/tournaments/{id}")
def get_tournament(id: str, db=Depends(get_db)):
    row = db.execute("SELECT data FROM tournaments WHERE id = ?", (id,)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    t = TournamentData(**json.loads(row["data"]))
    schedule = sorted(
        [m for m in t.matches if m.number and m.time],
        key=lambda x: (x.timestamp or "", x.court or ""),
    )
    return {"tournament": t, "schedule": schedule}


@router.put("/tournaments/{id}")
async def update_settings(
    id: str,
    data: TournamentCreate,
    db=Depends(get_db),
    user: str = Depends(get_current_user),
):
    row = db.execute("SELECT data FROM tournaments WHERE id = ?", (id,)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    t = TournamentData(**json.loads(row["data"]))
    new_teams = [x.strip() for x in data.teams.split("\n") if x.strip()]
    if t.type != data.type or t.teams != new_teams:
        t.type = data.type
        t.teams = new_teams
        t.matches = logic.generate_structure(t.teams, t.type)
        logic.refresh_bracket(t)
    t.name = data.name
    t.code = data.code
    t.date = data.date
    t.start_time = data.start_time
    t.match_duration = data.duration
    t.courts = [c.strip() for c in data.courts.split(",") if c.strip()]
    logic.update_schedule(t)
    db.execute("UPDATE tournaments SET data = ? WHERE id = ?", (t.json(), id))
    db.commit()
    await manager.broadcast({"type": "dashboard_update"})
    await manager.broadcast({"type": "tournament_update", "id": id})
    return {"status": "ok"}


@router.delete("/tournaments/{id}")
async def delete_tournament(
    id: str, db=Depends(get_db), user: str = Depends(get_current_user)
):
    db.execute("DELETE FROM tournaments WHERE id = ?", (id,))
    db.commit()
    await manager.broadcast({"type": "dashboard_update"})
    return {"status": "ok"}


@router.post("/tournaments/{id}/report")
async def report_score(
    id: str, report: ScoreReport, request: Request, db=Depends(get_db)
):
    is_admin = False
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            await get_current_user(token)
            is_admin = True
        except:
            pass

    row = db.execute("SELECT data FROM tournaments WHERE id = ?", (id,)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    t = TournamentData(**json.loads(row["data"]))

    if str(report.code).strip() != str(t.code).strip() and not is_admin:
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
        if report.sets:
            match.sets = report.sets
            p1s = sum(1 for s in match.sets if s.p1 > s.p2)
            p2s = sum(1 for s in match.sets if s.p2 > s.p1)
            match.p1_sets = p1s
            match.p2_sets = p2s
            if p1s > p2s:
                match.winner = match.p1
            elif p2s > p1s:
                match.winner = match.p2
            else:
                p1p = sum(s.p1 for s in match.sets)
                p2p = sum(s.p2 for s in match.sets)
                if p1p > p2p:
                    match.winner = match.p1
                elif p2p > p1p:
                    match.winner = match.p2
                else:
                    raise HTTPException(400, "Tie")
            match.status = "Finished"
        else:
            HTTPException(400, "No sets sumbitted")

    logic.refresh_bracket(t)
    logic.update_schedule(t)
    db.execute("UPDATE tournaments SET data = ? WHERE id = ?", (t.json(), id))
    db.commit()
    await manager.broadcast({"type": "tournament_update", "id": id})
    return {"status": "ok"}
