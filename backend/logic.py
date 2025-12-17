import math
from datetime import datetime, timedelta
from typing import List
from models import Match, TournamentData


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

    # Winners
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

    # Losers
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
    for _ in range(20):
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

    for m in t_obj.matches:
        if m.status == "Finished" and m.court in court_timers:
            fin = finish_times.get(m.id)
            if fin and fin > court_timers[m.court]:
                court_timers[m.court] = fin

    loop = len(t_obj.matches) * 2
    while unscheduled and loop > 0:
        loop -= 1
        best_court = min(court_timers, key=court_timers.get)
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
