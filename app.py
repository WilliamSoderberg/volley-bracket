import json
import math
import os
import secrets
import sqlite3
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from flask import (
    Flask,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", secrets.token_hex(16))


DB_DIR = os.getenv("DB_PATH", "./")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_HASH = generate_password_hash(os.getenv("ADMIN_PASSWORD", "admin"))
DATABASE = Path(DB_DIR) / "tournaments.db"
DATABASE.parent.mkdir(exist_ok=True)


def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def init_db():
    with app.app_context():
        db = get_db()
        db.execute(
            "CREATE TABLE IF NOT EXISTS tournaments (id TEXT PRIMARY KEY, data TEXT)"
        )
        db.commit()


init_db()


@dataclass
class Match:
    id: str
    bracket: str  # 'winners', 'losers', 'finals'
    round: int
    number: Optional[int] = None
    p1: Optional[str] = None
    p2: Optional[str] = None
    winner: Optional[str] = None

    # Dependency Graph
    source_p1: Optional[str] = None  # Match ID
    source_p2: Optional[str] = None  # Match ID
    source_p1_type: Optional[str] = None  # 'winner' or 'loser'
    source_p2_type: Optional[str] = None  # 'winner' or 'loser'
    next_win: Optional[str] = None  # Match ID
    next_loss: Optional[str] = None  # Match ID

    # Score Data
    sets: list[dict[str, Any]] = field(default_factory=list)
    p1_sets: int = 0
    p2_sets: int = 0

    # Scheduling
    court: Optional[str] = None
    time: Optional[str] = None
    timestamp: Optional[str] = None  # ISO format
    status: str = "Pending"

    # UI Helpers
    p1_label: str = "TBD"
    p2_label: str = "TBD"
    criticality: int = 0  # For scheduling priority


@dataclass
class Tournament:
    id: str
    name: str
    code: str
    type: str
    start_time: str
    match_duration: int
    teams: list[str]
    courts: list[str]
    date: str
    matches: list[Match] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, data):
        # Handle cases where data might be missing or matches need rehydration
        matches_data = data.pop("matches", [])
        # Create Match objects from the list of dicts
        matches = [Match(**m) for m in matches_data]
        return cls(matches=matches, **data)


def get_tournament(t_id) -> Optional[Tournament]:
    row = (
        get_db()
        .execute("SELECT data FROM tournaments WHERE id = ?", (t_id,))
        .fetchone()
    )
    if row:
        try:
            data = json.loads(row["data"])
            return Tournament.from_dict(data)
        except Exception as e:
            print(f"Error loading tournament {t_id}: {e}")
            return None
    return None


def save_tournament(t: Tournament):
    db = get_db()
    db.execute(
        "INSERT OR REPLACE INTO tournaments (id, data) VALUES (?, ?)",
        (t.id, json.dumps(t.to_dict())),
    )
    db.commit()


def delete_tournament_data(t_id):
    db = get_db()
    db.execute("DELETE FROM tournaments WHERE id = ?", (t_id,))
    db.commit()


def get_seeded_positions(num_slots, teams):
    seeds = [1, 2]
    while len(seeds) < num_slots:
        next_seeds = []
        for s in seeds:
            next_seeds.append(s)
            next_seeds.append(2 * len(seeds) + 1 - s)
        seeds = next_seeds
    return [teams[s - 1] if s <= len(teams) else "BYE" for s in seeds]


def generate_structure(teams, type="double") -> list[Match]:
    count = len(teams)
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

    # WB
    wb_rounds = power
    wb_matches: dict[int, list[Match]] = {r: [] for r in range(1, wb_rounds + 1)}
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

    # LB
    if type == "double" and size >= 4:
        lb_rounds = (wb_rounds - 1) * 2
        lb_matches: dict[int, list[Match]] = {r: [] for r in range(1, lb_rounds + 1)}
        current_count = size // 4

        for r in range(1, lb_rounds + 1):
            for _ in range(current_count):
                lb_matches[r].append(create_match_obj("losers", r))
            if r % 2 == 0:
                current_count //= 2

        for r in range(1, lb_rounds):
            for i, m in enumerate(lb_matches[r]):
                if r % 2 != 0:
                    target = lb_matches[r + 1][i]
                else:
                    target = lb_matches[r + 1][i // 2]

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
                if r == 1:
                    target = lb_layer[i // 2]
                    slot = "p1" if i % 2 == 0 else "p2"
                else:
                    if i < len(lb_layer):
                        target = lb_layer[i]
                    else:
                        target = lb_layer[-1]
                    slot = "p2"

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


def refresh_bracket(t_obj: Tournament):
    matches = {m.id: m for m in t_obj.matches}

    for _ in range(20):
        for m in t_obj.matches:

            def resolve_source(src_id, type):
                if not src_id or src_id not in matches:
                    return None
                src = matches[src_id]
                if type == "winner":
                    return src.winner
                elif type == "loser":
                    if src.winner == "BYE":
                        return "BYE"
                    if src.winner:
                        return src.p1 if src.winner == src.p2 else src.p2
                return None

            if m.source_p1:
                m.p1 = resolve_source(m.source_p1, m.source_p1_type)
            if m.source_p2:
                m.p2 = resolve_source(m.source_p2, m.source_p2_type)

            # Invalidation Logic
            if m.status == "Finished" and m.winner != "BYE":
                should_reset = False
                if not m.p1 or not m.p2:
                    should_reset = True
                elif m.winner != m.p1 and m.winner != m.p2:
                    should_reset = True

                if should_reset:
                    m.winner = None
                    m.status = "Pending"
                    m.sets = []
                    m.p1_sets = 0
                    m.p2_sets = 0

            # Auto-resolve BYE
            if not m.winner:
                is_ghost = False
                if m.p1 == "BYE" or m.p2 == "BYE":
                    m.winner = (
                        "BYE"
                        if (m.p1 == "BYE" and m.p2 == "BYE")
                        else (m.p2 if m.p1 == "BYE" else m.p1)
                    )
                    is_ghost = True
                if is_ghost:
                    m.status = "Finished"

    # Numbering
    sorted_matches = sorted(t_obj.matches, key=lambda x: int(x.id))
    display_counter = 1
    for m in sorted_matches:
        is_ghost = (m.winner == "BYE") or (m.p1 == "BYE" or m.p2 == "BYE")
        if is_ghost:
            m.number = None
        else:
            m.number = display_counter
            display_counter += 1

    # Recursive Labels
    def get_recursive_label(src_id, type_needed, depth=0):
        if not src_id or src_id not in matches:
            return "TBD"
        if depth > 10:
            return "TBD"
        src = matches[src_id]
        if src.number:
            prefix = "Winner" if type_needed == "winner" else "Loser"
            return f"{prefix} of #{src.number}"
        if type_needed == "winner":
            if src.p2 == "BYE":
                return get_recursive_label(src.source_p1, src.source_p1_type, depth + 1)
            elif src.p1 == "BYE":
                return get_recursive_label(src.source_p2, src.source_p2_type, depth + 1)
        return "BYE"

    for m in t_obj.matches:
        m.p1_label = get_recursive_label(m.source_p1, m.source_p1_type)
        m.p2_label = get_recursive_label(m.source_p2, m.source_p2_type)


def calculate_critical_path(matches: list[Match]):
    match_map = {m.id: m for m in matches}
    depth_cache = {}

    def get_depth(m_id):
        if m_id not in match_map:
            return 0
        if m_id in depth_cache:
            return depth_cache[m_id]
        m = match_map[m_id]
        win_depth = get_depth(m.next_win) if m.next_win else 0
        loss_depth = get_depth(m.next_loss) if m.next_loss else 0
        current_depth = 1 + max(win_depth, loss_depth)
        depth_cache[m_id] = current_depth
        return current_depth

    for m in matches:
        m.criticality = get_depth(m.id)


def update_schedule(t_obj: Tournament):
    calculate_critical_path(t_obj.matches)

    base_date = datetime.now().replace(second=0, microsecond=0)
    sh, sm = map(int, t_obj.start_time.split(":"))
    start_dt = base_date.replace(hour=sh, minute=sm)
    duration = int(t_obj.match_duration)
    match_finish_times = {}
    court_timers = {c: start_dt for c in t_obj.courts}

    unscheduled: list[Match] = []
    for m in t_obj.matches:
        is_bye = m.winner == "BYE" or m.p1 == "BYE" or m.p2 == "BYE"
        if is_bye:
            match_finish_times[m.id] = start_dt
            m.status = "Finished"
        elif m.status == "Finished":
            fin = start_dt + timedelta(minutes=duration)
            if m.timestamp:
                try:
                    actual = datetime.fromisoformat(m.timestamp)
                    fin = actual + timedelta(minutes=duration)
                except:
                    pass
            match_finish_times[m.id] = fin
        else:
            m.time = None
            m.timestamp = None
            m.court = None
            m.status = "Pending"
            unscheduled.append(m)

    # Fix court times based on finished matches
    for m in t_obj.matches:
        if (
            m.status == "Finished"
            and m.court
            and m.timestamp
            and m.court in court_timers
        ):
            fin = match_finish_times.get(m.id)
            if fin and fin > court_timers[m.court]:
                court_timers[m.court] = fin

    loop_limit = len(t_obj.matches) * 2
    while unscheduled and loop_limit > 0:
        loop_limit -= 1
        best_court = min(court_timers, key=court_timers.get)  # type: ignore
        current_time = court_timers[best_court]

        ready_pool: list[Match] = []
        for m in unscheduled:
            p1_ok = (not m.source_p1) or (m.source_p1 in match_finish_times)
            p1_ready = match_finish_times.get(m.source_p1, start_dt)
            p2_ok = (not m.source_p2) or (m.source_p2 in match_finish_times)
            p2_ready = match_finish_times.get(m.source_p2, start_dt)

            if p1_ok and p2_ok:
                if max(p1_ready, p2_ready) <= current_time:
                    ready_pool.append(m)

        if ready_pool:
            ready_pool.sort(
                key=lambda x: (
                    getattr(x, "est") if hasattr(x, "est") else start_dt,
                    -x.criticality,
                    x.round,
                )
            )
            candidate = ready_pool[0]
            candidate.court = best_court
            candidate.time = current_time.strftime("%H:%M")
            candidate.timestamp = current_time.isoformat()
            candidate.status = "Scheduled"
            fin = current_time + timedelta(minutes=duration)
            match_finish_times[candidate.id] = fin
            court_timers[best_court] = fin
            unscheduled.remove(candidate)
        else:
            # Fast forward
            next_wake = None
            for m in unscheduled:
                p1_ok = (not m.source_p1) or (m.source_p1 in match_finish_times)
                p2_ok = (not m.source_p2) or (m.source_p2 in match_finish_times)
                if p1_ok and p2_ok:
                    t1 = match_finish_times.get(m.source_p1, start_dt)
                    t2 = match_finish_times.get(m.source_p2, start_dt)
                    r = max(t1, t2)
                    if r > current_time:
                        if next_wake is None or r < next_wake:
                            next_wake = r
            if next_wake:
                court_timers[best_court] = next_wake
            else:
                break


# --- ROUTES ---
@app.route("/")
def index():
    db = get_db()
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
    return render_template(
        "index.html", live=live, future=future, past=past, tournaments=tournaments
    )


@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    if data["username"] == ADMIN_USER and check_password_hash(
        ADMIN_HASH, data["password"]
    ):
        session["is_admin"] = True
        return jsonify({"status": "success"})
    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("is_admin", None)
    return jsonify({"status": "success"})


@app.route("/api/check-auth")
def check_auth():
    return jsonify({"is_admin": session.get("is_admin", False)})


@app.route("/api/t/<t_id>")
def get_tournament_json(t_id):
    t = get_tournament(t_id)
    if not t:
        return jsonify({"error": "Not found"}), 404
    t_dict = t.to_dict()
    schedule = sorted(
        [m for m in t_dict["matches"] if m["number"] and m["time"]],
        key=lambda x: (x["timestamp"], x["court"]),
    )
    return jsonify({"tournament": t_dict, "schedule": schedule})


@app.route("/create", methods=["POST"])
def create_tournament():
    if not session.get("is_admin"):
        return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json(silent=True) or request.form
    teams = [t.strip() for t in data.get("teams", "").split("\n") if t.strip()]
    if len(teams) < 2:
        return (
            jsonify({"error": "At least 2 teams are required to create a tournament."}),
            400,
        )

    courts = [c.strip() for c in data.get("courts", "").split(",") if c.strip()]
    t_id = str(uuid.uuid4())[:8]
    t_date = data.get("date") or datetime.now().strftime("%Y-%m-%d")

    t = Tournament(
        id=t_id,
        name=data.get("name", ""),
        code=data.get("code", "0000"),
        teams=teams,
        courts=courts,
        match_duration=int(data.get("duration", 30)),
        start_time=data.get("start_time", "09:00"),
        type=data.get("type", "double"),
        date=t_date,
        matches=generate_structure(teams, data.get("type", "double")),
    )
    refresh_bracket(t)
    update_schedule(t)
    save_tournament(t)

    if request.is_json:
        return jsonify({"status": "ok", "id": t_id})
    return redirect(url_for("view_tournament", t_id=t_id))


@app.route("/t/<t_id>")
def view_tournament(t_id):
    t = get_tournament(t_id)
    if not t:
        return redirect("/")
    t_dict = t.to_dict()
    schedule = sorted(
        [m for m in t_dict["matches"] if m["number"] and m["time"]],
        key=lambda x: (x["timestamp"], x["court"]),
    )
    return render_template("view.html", t=t_dict, schedule=schedule)


@app.route("/api/report/<t_id>", methods=["POST"])
def report_score(t_id):
    t = get_tournament(t_id)
    if not t:
        return jsonify({"error": "Tournament not found"}), 404

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    if str(data.get("code", "")).strip() != str(t.code).strip() and not session.get(
        "is_admin"
    ):
        return jsonify({"error": "Invalid Tournament Code"}), 403

    match = next((m for m in t.matches if m.id == data.get("id")), None)

    if match:
        if data.get("clear"):
            match.winner = None
            match.sets = []
            match.p1_sets = 0
            match.p2_sets = 0
            match.status = "Pending"
        else:
            if not match.p1 or not match.p2:
                return jsonify({"error": "Teams not determined"}), 400

            match.sets = data.get("sets", [])
            p1s = 0
            p2s = 0
            p1_points = 0
            p2_points = 0

            for s in match.sets:
                try:
                    s1, s2 = int(s["p1"]), int(s["p2"])
                except (ValueError, TypeError):
                    continue

                p1_points += s1
                p2_points += s2

                if s1 > s2:
                    p1s += 1
                elif s2 > s1:
                    p2s += 1
            match.p1_sets = p1s
            match.p2_sets = p2s

            if p1s > p2s:
                match.winner = match.p1
            elif p2s > p1s:
                match.winner = match.p2
            else:
                # Sets are tied (or 0-0), determine winner by total points
                if p1_points > p2_points:
                    match.winner = match.p1
                elif p2_points > p1_points:
                    match.winner = match.p2
                else:
                    return (
                        jsonify({"error": "Match Tied (Sets and Total Points equal)"}),
                        400,
                    )

            match.status = "Finished"

        refresh_bracket(t)
        update_schedule(t)
        save_tournament(t)
        return jsonify({"status": "ok"})
    return jsonify({"error": "Match not found"}), 404


@app.route("/api/settings/<t_id>", methods=["POST"])
def settings(t_id):
    if not session.get("is_admin"):
        return jsonify({"error": "Unauthorized"}), 403
    t = get_tournament(t_id)
    data = request.json
    if not t:
        return jsonify({"error": "Tournament not found"}), 404

    old_type = t.type
    old_teams = t.teams

    new_teams = [
        x.strip() for x in data.get("teams", "").split("\n") or t.teams if x.strip()
    ]
    if len(new_teams) < 2:
        return (
            jsonify({"error": "At least 2 teams are required to generate a bracket."}),
            400,
        )

    if new_teams != t.teams:
        t.teams = new_teams

    # Update metadata
    t.name = data.get("name", t.name)
    t.date = data.get("date", t.date)
    t.code = data.get("code", t.code)
    t.type = data.get("type", t.type)
    t.courts = [c.strip() for c in data["courts"].split(",") if c.strip()]
    t.start_time = data.get("start_time", t.start_time)
    t.match_duration = int(data.get("duration", t.match_duration))

    if old_teams != t.teams or old_type != t.type or data.get("recalculate"):
        t.matches = generate_structure(new_teams, t.type)
        refresh_bracket(t)

    update_schedule(t)
    save_tournament(t)
    return jsonify({"status": "ok"})


@app.route("/api/delete/<t_id>", methods=["POST"])
def delete_tournament(t_id):
    if not session.get("is_admin"):
        return jsonify({"error": "Unauthorized"}), 403
    delete_tournament_data(t_id)
    return jsonify({"status": "ok"})


@app.errorhandler(Exception)  # type: ignore
def handle_exception(e):
    if request.path.startswith("/api/"):
        if isinstance(e, HTTPException):
            return jsonify({"error": e.description}), e.code
        return jsonify({"error": str(e)}), 500
    return redirect("/")


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() in ["true", "1", "t"]
    port = int(os.getenv("PORT", 8080))
    app.run(debug=debug_mode, host="0.0.0.0", port=port)
