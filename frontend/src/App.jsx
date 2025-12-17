import React, { useState, useEffect, useRef } from 'react';
import {
  Volleyball, ListDashes, TreeStructure, Moon, Sun,
  Plus, Sliders, X, Trophy, Clock, LockKey, SignOut,
  CalendarBlank, ClockCounterClockwise, MagnifyingGlass,
  CourtBasketball, Check
} from '@phosphor-icons/react';

// --- API CLIENT ---
const API_BASE = "http://localhost:8080"; // Change in production

const api = {
  get: async (url) => {
    const res = await fetch(`${API_BASE}${url}`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  post: async (url, data) => {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) throw await res.json();
    return res.json();
  }
};

// --- HELPERS ---
const COURT_COLORS = ['#ea580c', '#0284c7', '#059669', '#ca8a04', '#dc2626', '#0891b2', '#e11d48', '#65a30d'];
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return COURT_COLORS[Math.abs(hash) % COURT_COLORS.length];
};

// --- COMPONENTS ---

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">{title}</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition">
              <X size={24} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

const SettingsForm = ({ tournament, onSubmit, onDelete }) => {
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Validate teams
    const teams = data.teams.split('\n').filter(t => t.trim().length > 0);
    if (teams.length < 2) {
      setError("At least 2 teams required.");
      return;
    }

    try {
      if (tournament) await api.post(`/api/settings/${tournament.id}`, data);
      else await api.post('/create', data);
      onSubmit();
    } catch (err) {
      setError(err.detail || "Error saving");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-500 text-xs p-2 rounded text-center">{error}</div>}

      <div>
        <label className="text-xs font-bold text-zinc-500 uppercase">Name</label>
        <input name="name" defaultValue={tournament?.name} required className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white focus:border-orange-500 outline-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase">Code</label>
          <input name="code" defaultValue={tournament?.code || ""} required className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-center font-mono text-zinc-900 dark:text-white focus:border-orange-500 outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase">Type</label>
          <select name="type" defaultValue={tournament?.type || "double"} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white focus:border-orange-500 outline-none">
            <option value="double">Double Elim</option>
            <option value="single">Single Elim</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase">Duration</label>
          <input type="number" name="duration" defaultValue={tournament?.match_duration || 30} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white focus:border-orange-500 outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase">Start</label>
          <input type="time" name="start_time" defaultValue={tournament?.start_time || "09:00"} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white focus:border-orange-500 outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase">Date</label>
          <input type="date" name="date" defaultValue={tournament?.date || new Date().toISOString().split('T')[0]} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white focus:border-orange-500 outline-none" />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-zinc-500 uppercase">Courts</label>
        <input name="courts" defaultValue={tournament?.courts.join(', ') || ""} required placeholder="Center, Court 1" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white focus:border-orange-500 outline-none" />
      </div>

      <div>
        <label className="text-xs font-bold text-zinc-500 uppercase">Teams</label>
        <textarea name="teams" defaultValue={tournament?.teams.join('\n') || ""} required placeholder="One team per line" rows={6} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded p-2 font-mono text-sm text-zinc-900 dark:text-white focus:border-orange-500 outline-none" />
      </div>

      <div className="flex justify-between pt-4 border-t border-zinc-200 dark:border-zinc-700">
        {tournament && <button type="button" onClick={() => onDelete(tournament.id)} className="text-red-500 text-sm hover:underline">Delete</button>}
        <div className="flex-1"></div>
        <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition">{tournament ? 'Save' : 'Create'}</button>
      </div>
    </form>
  );
};

const ScoreForm = ({ match, tournamentCode, isAdmin, onSubmit, onClear }) => {
  const [sets, setSets] = useState(match.sets.length ? match.sets : [{ p1: '', p2: '' }]);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    try {
      await onSubmit(match.id, sets, code);
    } catch (err) {
      setError(err.detail || "Error");
    }
  };

  const updateSet = (idx, field, val) => {
    const newSets = [...sets];
    newSets[idx][field] = parseInt(val) || 0;
    setSets(newSets);
  };

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 text-red-500 p-2 rounded text-center text-sm">{error}</div>}

      {!isAdmin && (
        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <label className="block text-xs font-bold text-orange-500 uppercase mb-2">Tournament Code</label>
          <input type="password" value={code} onChange={e => setCode(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-center tracking-[0.5em] text-zinc-900 dark:text-white outline-none focus:border-orange-500" placeholder="••••" />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center font-bold text-zinc-700 dark:text-zinc-300 items-center">
        <div className="text-sm truncate">{match.p1 || match.p1_label}</div>
        <div className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full w-fit mx-auto">VS</div>
        <div className="text-sm truncate">{match.p2 || match.p2_label}</div>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {sets.map((s, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <input type="number" value={s.p1} onChange={e => updateSet(i, 'p1', e.target.value)} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-center text-zinc-900 dark:text-white outline-none focus:border-orange-500" />
            <span className="text-zinc-400 text-center">-</span>
            <input type="number" value={s.p2} onChange={e => updateSet(i, 'p2', e.target.value)} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-center text-zinc-900 dark:text-white outline-none focus:border-orange-500" />
          </div>
        ))}
      </div>

      <button onClick={() => setSets([...sets, { p1: '', p2: '' }])} className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-orange-500 rounded text-sm transition">+ Add Set</button>

      <div className="flex gap-2 pt-2">
        {match.winner && <button onClick={() => onClear(match.id, code)} className="w-1/3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg font-bold text-sm">Clear</button>}
        <button onClick={handleSubmit} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-lg font-bold shadow-lg transition">Submit</button>
      </div>
    </div>
  );
};

const BracketView = ({ matches, onMatchClick }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  // SVG Drawing Logic
  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;
    const container = containerRef.current.getBoundingClientRect();
    const svg = svgRef.current;

    // Clear previous lines
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    matches.forEach(m => {
      const startEl = document.getElementById(`match-${m.id}`);
      const endEl = document.getElementById(`match-${m.next_win}`);

      if (startEl && endEl && startEl.offsetParent && endEl.offsetParent) {
        const r1 = startEl.getBoundingClientRect();
        const r2 = endEl.getBoundingClientRect();

        // Coords relative to container
        const sx = r1.right - container.left;
        const sy = r1.top + r1.height / 2 - container.top;
        const ex = r2.left - container.left;
        const ey = r2.top + r2.height / 2 - container.top;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const c1 = sx + (ex - sx) / 2;
        path.setAttribute("d", `M ${sx} ${sy} C ${c1} ${sy}, ${c1} ${ey}, ${ex} ${ey}`);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("opacity", "0.3");
        path.classList.add("text-zinc-400", "dark:text-zinc-600");
        svg.appendChild(path);
      }
    });
  }, [matches]); // Redraw when matches change

  // Bracket Organization
  const wb = matches.filter(m => m.bracket !== 'losers' && m.bracket !== 'finals');
  const lb = matches.filter(m => m.bracket === 'losers');
  const fin = matches.filter(m => m.bracket === 'finals');

  const renderTree = (list) => {
    const rounds = {};
    list.forEach(m => { if (!rounds[m.round]) rounds[m.round] = []; rounds[m.round].push(m); });
    return Object.keys(rounds).sort((a, b) => a - b).map(r => (
      <div key={r} className="flex flex-col justify-center gap-8 min-w-[280px] z-10">
        {rounds[r].sort((a, b) => parseInt(a.id) - parseInt(b.id)).map(m => (
          <MatchCard key={m.id} match={m} onClick={() => onMatchClick(m)} />
        ))}
      </div>
    ));
  };

  return (
    <div className="overflow-auto h-full p-8 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:20px_20px]">
      <div ref={containerRef} className="relative min-w-max p-4 flex flex-col gap-16">
        <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

        <div className="flex gap-16 items-center">
          <div className="flex gap-16 relative">
            <div className="absolute -top-10 left-0 font-bold text-zinc-400 text-xs uppercase tracking-widest">Winners Bracket</div>
            {renderTree(wb)}
          </div>
          {fin.length > 0 && (
            <div className="flex flex-col justify-center items-center gap-4 z-10 relative">
              <div className="absolute -top-10 font-bold text-orange-500 text-xs uppercase tracking-widest bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">Championship</div>
              {fin.map(m => <MatchCard key={m.id} match={m} onClick={() => onMatchClick(m)} />)}
            </div>
          )}
        </div>

        {lb.length > 0 && (
          <div className="flex gap-16 pt-8 border-t border-zinc-200 dark:border-zinc-800 relative">
            <div className="absolute top-2 left-0 font-bold text-zinc-400 text-xs uppercase tracking-widest">Losers Bracket</div>
            {renderTree(lb)}
          </div>
        )}
      </div>
    </div>
  );
};

const MatchCard = ({ match, onClick }) => {
  if (!match.number) return <div id={`match-${match.id}`} className="hidden" />;

  const borderColor = match.winner
    ? 'border-orange-500 ring-1 ring-orange-500'
    : 'border-zinc-300 dark:border-zinc-700';

  const badgeColor = match.time ? stringToColor(match.court + 'seed') : 'gray';

  return (
    <div
      id={`match-${match.id}`}
      onClick={onClick}
      className={`w-64 bg-white dark:bg-zinc-900 rounded-xl border ${borderColor} shadow-sm cursor-pointer hover:-translate-y-1 transition group overflow-hidden`}
    >
      <div className="bg-zinc-50 dark:bg-zinc-950/50 px-4 py-2 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">#{match.number}</span>
          {match.time && <span className="text-[10px] font-bold text-white px-2 rounded" style={{ background: badgeColor }}>{match.court}</span>}
        </div>
        {match.winner ? <Check className="text-orange-500" weight="bold" /> : <span className="text-xs font-mono font-bold text-zinc-500">{match.time}</span>}
      </div>
      <div className="p-3 space-y-2 text-sm">
        <div className={`flex justify-between ${match.winner === match.p1 ? 'text-orange-600 dark:text-orange-500 font-bold' : 'text-zinc-600 dark:text-zinc-400'}`}>
          <span className="truncate">{match.p1 || match.p1_label}</span>
          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 rounded text-xs">{match.p1_sets}</span>
        </div>
        <div className={`flex justify-between ${match.winner === match.p2 ? 'text-orange-600 dark:text-orange-500 font-bold' : 'text-zinc-600 dark:text-zinc-400'}`}>
          <span className="truncate">{match.p2 || match.p2_label}</span>
          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 rounded text-xs">{match.p2_sets}</span>
        </div>
      </div>
    </div>
  );
};

const ScheduleView = ({ schedule, onMatchClick }) => {
  const [filter, setFilter] = useState("");
  const filtered = schedule.filter(m =>
    (m.p1 || "").toLowerCase().includes(filter.toLowerCase()) ||
    (m.p2 || "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto h-full overflow-auto">
      <div className="mb-6 relative">
        <input
          placeholder="Search teams..."
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 pl-10 outline-none focus:ring-2 focus:ring-orange-500 text-zinc-900 dark:text-white transition"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-12 bg-zinc-50 dark:bg-zinc-950/50 p-3 text-xs font-bold text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800">
          <div className="col-span-3">Time / Court</div>
          <div className="col-span-6">Matchup</div>
          <div className="col-span-3 text-right">Result</div>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {filtered.map(m => (
            <div key={m.id} className="p-4 md:grid md:grid-cols-12 md:items-center hover:bg-zinc-50 dark:hover:bg-zinc-950/30 transition">
              <div className="col-span-3 mb-2 md:mb-0">
                <div className="font-mono font-bold text-lg text-zinc-900 dark:text-white">{m.time}</div>
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase" style={{ background: stringToColor(m.court + 'seed') }}>{m.court}</div>
              </div>
              <div className="col-span-6 mb-3 md:mb-0">
                <div className="font-medium text-base text-zinc-900 dark:text-zinc-100">
                  {m.p1 || <span className="italic text-zinc-400">{m.p1_label}</span>}
                  <span className="text-zinc-400 mx-2 text-xs">VS</span>
                  {m.p2 || <span className="italic text-zinc-400">{m.p2_label}</span>}
                </div>
                <div className="text-xs text-zinc-400 mt-1">Match #{m.number} • R{m.round}</div>
              </div>
              <div className="col-span-3 text-right">
                {m.winner ? (
                  <button onClick={() => onMatchClick(m)} className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                    <span className="text-orange-500 font-bold">{m.winner}</span>
                    <div className="text-xs font-mono text-zinc-500">{m.p1_sets}-{m.p2_sets}</div>
                  </button>
                ) : (
                  (m.p1 && m.p2) ? (
                    <button onClick={() => onMatchClick(m)} className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg shadow-orange-900/20 transition">
                      Report
                    </button>
                  ) : <span className="text-xs text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded">Waiting</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ live, future, past, onSelect, onEdit }) => {
  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-10">
      {live && Object.keys(live).length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Live Today
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.values(live).map(t => <DashCard key={t.id} t={t} onClick={() => onSelect(t.id)} onEdit={(e) => { e.stopPropagation(); onEdit(t.id) }} />)}
          </div>
        </section>
      )}

      {future && Object.keys(future).length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2"><CalendarBlank size={20} /> Upcoming</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.values(future).map(t => <DashCard key={t.id} t={t} onClick={() => onSelect(t.id)} onEdit={(e) => { e.stopPropagation(); onEdit(t.id) }} />)}
          </div>
        </section>
      )}

      {past && Object.keys(past).length > 0 && (
        <section className="opacity-75 hover:opacity-100 transition duration-500">
          <h2 className="text-lg font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2"><ClockCounterClockwise size={20} /> Past</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.values(past).map(t => <DashCard key={t.id} t={t} onClick={() => onSelect(t.id)} onEdit={(e) => { e.stopPropagation(); onEdit(t.id) }} />)}
          </div>
        </section>
      )}
    </div>
  );
};

const DashCard = ({ t, onClick, onEdit }) => (
  <div onClick={onClick} className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 border border-zinc-200 dark:border-zinc-800 cursor-pointer group overflow-hidden relative">
    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 group-hover:w-2 transition-all"></div>
    <div className="p-6 pl-8">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-xl text-zinc-900 dark:text-white">{t.name}</h3>
        <button onClick={onEdit} className="text-zinc-300 hover:text-orange-500 transition"><Sliders size={20} /></button>
      </div>
      <div className="flex items-center gap-2 text-zinc-500 text-sm mb-4">
        <CalendarBlank /> {t.date}
        <span className="w-1 h-1 bg-zinc-300 rounded-full"></span>
        <Clock /> {t.start_time}
      </div>
      <div className="flex gap-2">
        <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700">{t.type}</span>
        <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700">{t.teams.length} Teams</span>
      </div>
    </div>
  </div>
);

// --- MAIN APP ---
export default function App() {
  const [view, setView] = useState('dashboard'); // dashboard, tournament
  const [tId, setTId] = useState(null);
  const [data, setData] = useState({ live: {}, future: {}, past: {} });
  const [tData, setTData] = useState(null);
  const [tab, setTab] = useState(localStorage.getItem('volleyView') || 'bracket');
  const [isAdmin, setIsAdmin] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.theme === 'dark');

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create, object = edit
  const [scoreMatch, setScoreMatch] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  // Initial Load
  useEffect(() => {
    checkAuth();
    loadDashboard();
    if (darkMode) document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    if (tId) {
      const interval = setInterval(loadTournament, 5000);
      loadTournament();
      return () => clearInterval(interval);
    }
  }, [tId]);

  const checkAuth = async () => {
    const res = await api.get('/api/check-auth');
    setIsAdmin(res.is_admin);
  };

  const loadDashboard = async () => {
    const res = await api.get('/api/tournaments');
    setData(res);
  };

  const loadTournament = async () => {
    if (!tId) return;
    const res = await api.get(`/api/t/${tId}`);
    setTData(res);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const u = e.target.username.value;
    const p = e.target.password.value;
    try {
      await api.post('/api/login', { username: u, password: p });
      setIsAdmin(true);
      setShowLogin(false);
    } catch {
      alert("Invalid");
    }
  };

  const handleLogout = async () => {
    await api.post('/api/logout');
    setIsAdmin(false);
    window.location.reload();
  };

  // Actions
  const openCreate = () => { setEditTarget(null); setShowSettings(true); };
  const openEdit = async (id) => {
    // If we have data in dashboard use it, else fetch
    let t = data.all?.[id];
    if (!t) t = (await api.get(`/api/t/${id}`)).tournament;
    setEditTarget(t);
    setShowSettings(true);
  };

  const submitScore = async (id, sets, code) => {
    await api.post(`/api/report/${tId}`, { id, sets, code });
    setScoreMatch(null);
    loadTournament();
  };

  const clearScore = async (id, code) => {
    await api.post(`/api/report/${tId}`, { id, code, clear: true });
    setScoreMatch(null);
    loadTournament();
  };

  const deleteTournament = async (id) => {
    if (!confirm("Are you sure?")) return;
    await api.post(`/api/delete/${id}`);
    setShowSettings(false);
    setView('dashboard');
    loadDashboard();
  };

  // View Routing
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-200">

      {/* Navbar */}
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setView('dashboard'); setTId(null); }}>
            <Volleyball size={32} className="text-orange-500" weight="fill" />
            <div>
              <h1 className="text-xl font-bold leading-none hidden md:block">VolleyManager</h1>
              <p className="text-xs text-zinc-500 hidden md:block">Tournament Organizer</p>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 font-bold text-lg truncate max-w-[150px] md:max-w-md">
            {view === 'tournament' && tData?.tournament.name}
          </div>

          <div className="flex items-center gap-3">
            {isAdmin ? (
              <>
                {view === 'tournament' && <button onClick={() => openEdit(tId)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><Sliders size={20} /></button>}
                {view === 'dashboard' && <button onClick={openCreate} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2"><Plus weight="bold" /> <span className="hidden sm:inline">Create</span></button>}
                <button onClick={handleLogout} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-red-500"><SignOut size={20} /></button>
              </>
            ) : (
              <button onClick={() => setShowLogin(true)} className="flex items-center gap-1 text-orange-600 font-bold hover:text-orange-500"><LockKey /> Login</button>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="h-[calc(100vh-73px)] overflow-hidden">
        {view === 'dashboard' ? (
          <div className="h-full overflow-y-auto">
            <Dashboard live={data.live} future={data.future} past={data.past} onSelect={(id) => { setTId(id); setView('tournament'); }} onEdit={openEdit} />
          </div>
        ) : (
          tData && (
            <div className="h-full relative">
              {tab === 'bracket' ? (
                <BracketView matches={tData.tournament.matches} onMatchClick={(m) => (m.p1 && m.p2) && setScoreMatch(m)} />
              ) : (
                <ScheduleView schedule={tData.schedule} onMatchClick={(m) => (m.p1 && m.p2) && setScoreMatch(m)} />
              )}
            </div>
          )
        )}
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        {view === 'tournament' && (
          <button
            onClick={() => { const n = tab === 'bracket' ? 'schedule' : 'bracket'; setTab(n); localStorage.setItem('volleyView', n); }}
            className="p-3 bg-orange-600 hover:bg-orange-500 text-white rounded-full shadow-xl shadow-orange-900/20 hover:scale-110 transition"
          >
            {tab === 'bracket' ? <ListDashes size={24} /> : <TreeStructure size={24} />}
          </button>
        )}
        <button
          onClick={() => { setDarkMode(!darkMode); document.documentElement.classList.toggle('dark'); localStorage.theme = !darkMode ? 'dark' : 'light'; }}
          className="p-3 bg-zinc-800 dark:bg-white text-white dark:text-zinc-900 rounded-full shadow-xl hover:scale-110 transition"
        >
          {darkMode ? <Sun size={24} weight="fill" /> : <Moon size={24} weight="fill" />}
        </button>
      </div>

      {/* Modals */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title={editTarget ? 'Settings' : 'Create Tournament'}>
        <SettingsForm tournament={editTarget} onSubmit={() => { setShowSettings(false); if (view === 'dashboard') loadDashboard(); else loadTournament(); }} onDelete={deleteTournament} />
      </Modal>

      <Modal isOpen={!!scoreMatch} onClose={() => setScoreMatch(null)} title={`Match #${scoreMatch?.number || ''}`}>
        {scoreMatch && <ScoreForm match={scoreMatch} tournamentCode={tData?.tournament.code} isAdmin={isAdmin} onSubmit={submitScore} onClear={clearScore} />}
      </Modal>

      <Modal isOpen={showLogin} onClose={() => setShowLogin(false)} title="Admin Access">
        <form onSubmit={handleLogin} className="space-y-4">
          <input name="username" placeholder="Username" className="w-full border p-2 rounded dark:bg-zinc-950 dark:border-zinc-700 dark:text-white" />
          <input name="password" type="password" placeholder="Password" className="w-full border p-2 rounded dark:bg-zinc-950 dark:border-zinc-700 dark:text-white" />
          <button className="w-full bg-orange-600 text-white py-2 rounded font-bold">Login</button>
        </form>
      </Modal>

    </div>
  );
}