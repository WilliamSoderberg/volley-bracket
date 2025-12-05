import json
import math
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path

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
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.exceptions import HTTPException

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


def get_tournament(t_id):
    row = (
        get_db()
        .execute("SELECT data FROM tournaments WHERE id = ?", (t_id,))
        .fetchone()
    )
    return json.loads(row["data"]) if row else None


def save_tournament(t_id, data):
    db = get_db()
    db.execute(
        "INSERT OR REPLACE INTO tournaments (id, data) VALUES (?, ?)",
        (t_id, json.dumps(data)),
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


def generate_structure(teams, type="double"):
    count = len(teams)
    power = math.ceil(math.log2(count)) if count > 0 else 1
    size = 2**power
    seeded_teams = get_seeded_positions(size, teams)
    matches = []
    match_counter = 1

    def create_match(bracket, round_n):
        nonlocal match_counter
        m = {
            "id": str(match_counter),
            "number": None,
            "bracket": bracket,
            "round": round_n,
            "p1": None,
            "p2": None,
            "winner": None,
            "source_p1": None,
            "source_p2": None,
            "source_p1_type": None,
            "source_p2_type": None,
            "sets": [],
            "p1_sets": 0,
            "p2_sets": 0,
            "next_win": None,
            "next_loss": None,
            "court": None,
            "time": None,
            "timestamp": None,
            "status": "Pending",
            "p1_label": "TBD",
            "p2_label": "TBD",
        }
        match_counter += 1
        matches.append(m)
        return m

    wb_rounds = power
    wb_matches = {r: [] for r in range(1, wb_rounds + 1)}
    for r in range(1, wb_rounds + 1):
        for _ in range(size // (2**r)):
            wb_matches[r].append(create_match("winners", r))

    for r in range(1, wb_rounds):
        for i, m in enumerate(wb_matches[r]):
            target = wb_matches[r + 1][i // 2]
            m["next_win"] = target["id"]
            if i % 2 == 0:
                target["source_p1"] = m["id"]
                target["source_p1_type"] = "winner"
            else:
                target["source_p2"] = m["id"]
                target["source_p2_type"] = "winner"

    for i, m in enumerate(wb_matches[1]):
        m["p1"] = seeded_teams[i * 2]
        m["p2"] = seeded_teams[i * 2 + 1]

    if type == "double" and size >= 4:
        lb_rounds = (wb_rounds - 1) * 2
        lb_matches = {r: [] for r in range(1, lb_rounds + 1)}
        current_count = size // 4
        for r in range(1, lb_rounds + 1):
            for _ in range(current_count):
                lb_matches[r].append(create_match("losers", r))
            if r % 2 != 0:
                pass
            else:
                current_count //= 2

        for r in range(1, lb_rounds):
            for i, m in enumerate(lb_matches[r]):
                if r % 2 != 0:
                    target = lb_matches[r + 1][i]
                else:
                    target = lb_matches[r + 1][i // 2]
                m["next_win"] = target["id"]
                if r % 2 != 0:
                    target["source_p1"] = m["id"]
                    target["source_p1_type"] = "winner"
                else:
                    if i % 2 == 0:
                        target["source_p1"] = m["id"]
                        target["source_p1_type"] = "winner"
                    else:
                        target["source_p2"] = m["id"]
                        target["source_p2_type"] = "winner"

        for r in range(1, wb_rounds):
            drop_round = 1 if r == 1 else (r - 1) * 2
            wb_layer = wb_matches[r]
            lb_layer = lb_matches[drop_round]
            for i, wb_m in enumerate(wb_layer):
                if r == 1:
                    target = lb_layer[i // 2]
                    slot = "p1" if i % 2 == 0 else "p2"
                else:
                    target = lb_layer[i] if i < len(lb_layer) else lb_layer[-1]
                    slot = "p2"
                wb_m["next_loss"] = target["id"]
                if slot == "p1":
                    target["source_p1"] = wb_m["id"]
                    target["source_p1_type"] = "loser"
                else:
                    target["source_p2"] = wb_m["id"]
                    target["source_p2_type"] = "loser"

        wb_final = wb_matches[wb_rounds][0]
        lb_final = lb_matches[lb_rounds][0]
        wb_final["next_loss"] = lb_final["id"]
        lb_final["source_p2"] = wb_final["id"]
        lb_final["source_p2_type"] = "loser"

        final = create_match("finals", 1)
        wb_final["next_win"] = final["id"]
        lb_final["next_win"] = final["id"]
        final["source_p1"] = wb_final["id"]
        final["source_p1_type"] = "winner"
        final["source_p2"] = lb_final["id"]
        final["source_p2_type"] = "winner"

    return matches


def refresh_bracket(t_data):
    matches = {m["id"]: m for m in t_data["matches"]}
    for _ in range(20):
        for m in t_data["matches"]:

            def resolve_source(src_id, type):
                if not src_id or src_id not in matches:
                    return None
                src = matches[src_id]
                if type == "winner":
                    return src["winner"]
                elif type == "loser":
                    if src["winner"] == "BYE":
                        return "BYE"
                    if src["winner"]:
                        return src["p1"] if src["winner"] == src["p2"] else src["p2"]
                return None

            if m["source_p1"]:
                m["p1"] = resolve_source(m["source_p1"], m["source_p1_type"])
            if m["source_p2"]:
                m["p2"] = resolve_source(m["source_p2"], m["source_p2_type"])

            if m["status"] == "Finished" and m["winner"] != "BYE":
                should_reset = False

                # 1. Missing Player (Dependency Cleared)
                if not m["p1"] or not m["p2"]:
                    should_reset = True

                # 2. Winner Mismatch (Player Changed)
                elif m["winner"] != m["p1"] and m["winner"] != m["p2"]:
                    should_reset = True

                if should_reset:
                    m["winner"] = None
                    m["status"] = "Pending"
                    m["sets"] = []
                    m["p1_sets"] = 0
                    m["p2_sets"] = 0

            if not m["winner"]:
                is_ghost = False
                if m["p1"] == "BYE" or m["p2"] == "BYE":
                    m["winner"] = (
                        "BYE"
                        if (m["p1"] == "BYE" and m["p2"] == "BYE")
                        else (m["p2"] if m["p1"] == "BYE" else m["p1"])
                    )
                    is_ghost = True
                if is_ghost:
                    m["status"] = "Finished"

    sorted_matches = sorted(t_data["matches"], key=lambda x: int(x["id"]))
    display_counter = 1
    for m in sorted_matches:
        is_ghost = (m["winner"] == "BYE") or (m["p1"] == "BYE" or m["p2"] == "BYE")
        if is_ghost:
            m["number"] = None
        else:
            m["number"] = display_counter
            display_counter += 1

    def get_recursive_label(src_id, type_needed, depth=0):
        if not src_id or src_id not in matches:
            return "TBD"
        if depth > 10:
            return "TBD"
        src = matches[src_id]
        if src["number"]:
            prefix = "Winner" if type_needed == "winner" else "Loser"
            return f"{prefix} of #{src['number']}"
        if type_needed == "winner":
            if src["p2"] == "BYE":
                return get_recursive_label(
                    src["source_p1"], src["source_p1_type"], depth + 1
                )
            elif src["p1"] == "BYE":
                return get_recursive_label(
                    src["source_p2"], src["source_p2_type"], depth + 1
                )
        return "BYE"

    for m in t_data["matches"]:
        m["p1_label"] = get_recursive_label(m["source_p1"], m["source_p1_type"])
        m["p2_label"] = get_recursive_label(m["source_p2"], m["source_p2_type"])


def update_schedule(t_data):
    matches = t_data["matches"]
    courts = t_data["courts"]
    base_date = datetime.now().replace(second=0, microsecond=0)
    sh, sm = map(int, t_data.get("start_time", "09:00").split(":"))
    start_dt = base_date.replace(hour=sh, minute=sm)
    duration = int(t_data.get("match_duration", 30))
    match_finish_times = {}
    court_timers = {c: start_dt for c in courts}

    unscheduled = []
    for m in matches:
        is_bye = m["winner"] == "BYE" or m["p1"] == "BYE" or m["p2"] == "BYE"
        if is_bye:
            match_finish_times[m["id"]] = start_dt
            m["status"] = "Finished"
        elif m["status"] == "Finished":
            fin = start_dt + timedelta(minutes=duration)
            if m.get("timestamp"):
                try:
                    actual = datetime.fromisoformat(m["timestamp"])
                    fin = actual + timedelta(minutes=duration)
                    if m.get("court") and m["court"] in court_timers:
                        if fin > court_timers[m["court"]]:
                            court_timers[m["court"]] = fin
                except:
                    pass
            match_finish_times[m["id"]] = fin
        else:
            m["time"] = None
            m["timestamp"] = None
            m["court"] = None
            m["status"] = "Pending"
            unscheduled.append(m)

    loop_limit = len(matches) * 2
    while unscheduled and loop_limit > 0:
        loop_limit -= 1
        best_court = min(court_timers, key=court_timers.get)  # type: ignore
        current_time = court_timers[best_court]

        ready_pool = []
        for m in unscheduled:
            p1_ok = (not m["source_p1"]) or (m["source_p1"] in match_finish_times)
            p1_ready_at = (
                match_finish_times[m["source_p1"]]
                if m["source_p1"] in match_finish_times
                else start_dt
            )
            p2_ok = (not m["source_p2"]) or (m["source_p2"] in match_finish_times)
            p2_ready_at = (
                match_finish_times[m["source_p2"]]
                if m["source_p2"] in match_finish_times
                else start_dt
            )

            if p1_ok and p2_ok:
                if max(p1_ready_at, p2_ready_at) <= current_time:
                    ready_pool.append(m)

        if ready_pool:
            ready_pool.sort(
                key=lambda x: (
                    x["round"],
                    0 if x["bracket"] == "losers" else 1,
                    int(x["id"]),
                )
            )
            candidate = ready_pool[0]
            candidate["court"] = best_court
            candidate["time"] = current_time.strftime("%H:%M")
            candidate["timestamp"] = current_time.isoformat()
            candidate["status"] = "Scheduled"
            fin = current_time + timedelta(minutes=duration)
            match_finish_times[candidate["id"]] = fin
            court_timers[best_court] = fin
            unscheduled.remove(candidate)
        else:
            next_wake_time = None
            for m in unscheduled:
                p1_ok = (not m["source_p1"]) or (m["source_p1"] in match_finish_times)
                p2_ok = (not m["source_p2"]) or (m["source_p2"] in match_finish_times)
                if p1_ok and p2_ok:
                    p1_t = match_finish_times.get(m["source_p1"], start_dt)
                    p2_t = match_finish_times.get(m["source_p2"], start_dt)
                    ready_at = max(p1_t, p2_t)
                    if ready_at > current_time:
                        if next_wake_time is None or ready_at < next_wake_time:
                            next_wake_time = ready_at
            if next_wake_time:
                court_timers[best_court] = next_wake_time
            else:
                break


# --- ROUTES ---
@app.route("/")
def index():
    db = get_db()
    rows = db.execute("SELECT * FROM tournaments").fetchall()
    tournaments = {row["id"]: json.loads(row["data"]) for row in rows}
    return render_template("index.html", tournaments=tournaments)


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
    schedule = sorted(
        [m for m in t["matches"] if m["number"] and m["time"]],
        key=lambda x: (x["timestamp"], x["court"]),
    )
    return jsonify({"tournament": t, "schedule": schedule})


@app.route("/create", methods=["POST"])
def create_tournament():
    if not session.get("is_admin"):
        return jsonify({"error": "Unauthorized"}), 403
    teams = [t.strip() for t in request.form.get("teams", "").split("\n") if t.strip()]
    courts = [c.strip() for c in request.form.get("courts", "").split(",") if c.strip()]
    t_id = str(uuid.uuid4())[:8]
    new_t = {
        "id": t_id,
        "name": request.form.get("name"),
        "code": request.form.get("code", "0000"),
        "teams": teams,
        "courts": courts,
        "match_duration": request.form.get("duration", 45),
        "start_time": request.form.get("start_time", "09:00"),
        "type": request.form.get("type", "double"),
        "matches": [],
    }
    new_t["matches"] = generate_structure(teams, new_t["type"])
    refresh_bracket(new_t)
    update_schedule(new_t)
    save_tournament(t_id, new_t)
    return redirect(url_for("view_tournament", t_id=t_id))


@app.route("/t/<t_id>")
def view_tournament(t_id):
    t = get_tournament(t_id)
    if not t:
        return redirect("/")
    schedule = sorted(
        [m for m in t["matches"] if m["number"] and m["time"]],
        key=lambda x: (x["timestamp"], x["court"]),
    )
    return render_template("view.html", t=t, schedule=schedule)


@app.route("/api/report/<t_id>", methods=["POST"])
def report_score(t_id):
    try:
        t = get_tournament(t_id)
        if not t:
            return jsonify({"error": "Tournament not found"}), 404

        # Use silent=True to avoid HTML 400 errors
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid or missing JSON body"}), 400

        # Force string comparison for code
        req_code = str(data.get("code", "")).strip()
        actual_code = str(t.get("code", "")).strip()

        if req_code != actual_code and not session.get("is_admin"):
            return jsonify({"error": "Invalid Tournament Code"}), 403

        m_id = data.get("id")
        match = next((m for m in t["matches"] if m["id"] == m_id), None)

        if match:
            if data.get("clear"):
                match["winner"] = None
                match["sets"] = []
                match["p1_sets"] = 0
                match["p2_sets"] = 0
                match["status"] = "Pending"
            else:
                if not match["p1"] or not match["p2"]:
                    return jsonify({"error": "Teams not determined yet"}), 400

                match["sets"] = data.get("sets", [])
                p1s = 0
                p2s = 0
                p1p = 0
                p2p = 0
                for s in match["sets"]:
                    s1, s2 = int(s["p1"]), int(s["p2"])
                    p1p += s1
                    p2p += s2
                    if s1 > s2:
                        p1s += 1
                    elif s2 > s1:
                        p2s += 1
                match["p1_sets"] = p1s
                match["p2_sets"] = p2s

                if p1s > p2s:
                    match["winner"] = match["p1"]
                elif p2s > p1s:
                    match["winner"] = match["p2"]
                elif p1p > p2p:
                    match["winner"] = match["p1"]
                elif p2p > p1p:
                    match["winner"] = match["p2"]
                else:
                    return jsonify({"error": "Match Tied"}), 400
                match["status"] = "Finished"

            refresh_bracket(t)
            update_schedule(t)
            save_tournament(t_id, t)
        else:
            return jsonify({"error": "Match not found"}), 404

        return jsonify({"status": "ok"})

    except Exception as e:
        return jsonify({"error": f"Server Error: {str(e)}"}), 500


@app.route("/api/settings/<t_id>", methods=["POST"])
def settings(t_id):
    if not session.get("is_admin"):
        return jsonify({"error": "Unauthorized"}), 403
    t = get_tournament(t_id)
    data = request.json
    if not t:
        return jsonify({"error": "Tournament not found"}), 404
    if data.get("recalculate"):
        update_schedule(t)
        save_tournament(t_id, t)
        return jsonify({"status": "ok"})

    should_reschedule = False
    if "name" in data:
        t["name"] = data["name"]
    if "courts" in data:
        t["courts"] = [c.strip() for c in data["courts"].split(",") if c.strip()]
        should_reschedule = True

    if "start_time" in data:
        t["start_time"] = data["start_time"]
        should_reschedule = True
    if "match_duration" in data:
        t["match_duration"] = int(data["match_duration"])
        should_reschedule = True

    if "teams" in data and data["teams"]:
        teams = [x.strip() for x in data["teams"].split("\n") if x.strip()]
        if len(teams) > 1 and teams != t["teams"]:
            t["teams"] = teams
            t["matches"] = generate_structure(teams, t["type"])
            refresh_bracket(t)
            update_schedule(t)
            should_reschedule = False

    if should_reschedule:
        update_schedule(t)
    save_tournament(t_id, t)
    return jsonify({"status": "ok"})


@app.route("/api/delete/<t_id>", methods=["POST"])
def delete_tournament(t_id):
    if not session.get("is_admin"):
        return jsonify({"error": "Unauthorized"}), 403
    delete_tournament_data(t_id)
    return jsonify({"status": "ok"})


# Global Error Handler to force JSON for API routes
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
