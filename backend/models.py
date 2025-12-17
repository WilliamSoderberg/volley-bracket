from pydantic import BaseModel
from typing import Optional, Literal


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

    # Graph Links
    source_p1: Optional[str] = None
    source_p2: Optional[str] = None
    source_p1_type: Optional[str] = None
    source_p2_type: Optional[str] = None
    next_win: Optional[str] = None
    next_loss: Optional[str] = None

    # State
    sets: list[SetResult] = []
    p1_sets: int = 0
    p2_sets: int = 0
    court: Optional[str] = None
    time: Optional[str] = None
    timestamp: Optional[str] = None
    status: str = "Pending"

    # UI
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
    teams: list[str]
    courts: list[str]
    date: str
    matches: list[Match] = []


class TournamentCreate(BaseModel):
    name: str
    date: str
    code: str
    type: Literal["single", "double"]
    courts: str
    duration: int
    start_time: str
    teams: str


class ScoreReport(BaseModel):
    id: str
    sets: Optional[list[SetResult]] = None
    code: Optional[str] = None
    clear: bool = False


class LoginRequest(BaseModel):
    username: str
    password: str
