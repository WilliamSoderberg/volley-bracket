import React, { useState, useEffect, useRef } from 'react';
import {
  VolleyballIcon, TreeStructureIcon, CalendarBlankIcon,
  CalendarDotsIcon, SunIcon, MoonIcon, UsersFourIcon,
  CourtBasketballIcon, ClockCounterClockwiseIcon, SignInIcon,
  SignOutIcon, SlidersHorizontalIcon, PlusIcon, XIcon, TrophyIcon,
  MagnifyingGlassIcon, ClockIcon, EraserIcon, LineVerticalIcon,
  CircleNotchIcon, CheckCircleIcon, CaretDownIcon, CaretUpIcon
} from "@phosphor-icons/react"

const API_BASE = "/api";
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

const getToken = () => localStorage.getItem('volleyToken');

const api = {
  request: async (method, url, data = null, isFormData = false) => {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const opts = { method, headers };
    if (data) opts.body = isFormData ? data : JSON.stringify(data);

    try {
      const res = await fetch(`${API_BASE}${url}`, opts);
      if (!res.ok) {
        if (res.status === 401) localStorage.removeItem('volleyToken');
        throw await res.json();
      }
      return res.json();
    } catch (err) {
      if (err instanceof TypeError) throw { detail: "network_error" };
      throw err;
    }
  },
  get: (url) => api.request('GET', url),
  post: (url, data) => api.request('POST', url, data),
  postForm: (url, data) => api.request('POST', url, data, true),
  put: (url, data) => api.request('PUT', url, data),
  delete: (url) => api.request('DELETE', url)
};

// --- HELPERS ---
const stringToColor = (str) => {
  if (!str) return '#71717a';
  const normalized = str.trim().toLowerCase();
  const salt = 'volley-v1-stable-colors-final';
  const COURT_COLORS = ['#ea580c', '#0284c7', '#059669', '#ca8a04', '#dc2626', '#0891b2', '#e11d48', '#65a30d'];
  let hash = 0;
  const combined = normalized + salt;
  for (let i = 0; i < combined.length; i++) hash = combined.charCodeAt(i) + ((hash << 5) - hash);
  return COURT_COLORS[Math.abs(hash) % COURT_COLORS.length];
};

// --- UI COMPONENTS ---

const Modal = ({ isOpen, onClose, title, children, icon: Icon, customWidth = "max-w-sm" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full ${customWidth} border border-zinc-200 dark:border-zinc-700 overflow-hidden max-h-[95vh] flex flex-col`}>
        <div className="p-6 overflow-y-auto">
          {title && (
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                {Icon && <Icon weight="duotone" className="text-orange-500" size={24} />}
                {title}
              </h2>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition">
                <XIcon size={24} />
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};

const ConnectivityAlert = ({ backendDown, isInitialLoad }) => {
  if (!backendDown || isInitialLoad) return null;
  return (
    <div className="sticky top-0 z-50 px-4 pt-4 shrink-0">
      <div className="bg-red-500 text-white p-3 rounded-2xl flex items-center gap-3 shadow-xl shadow-red-900/20 border border-red-400/50">
        <div className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-100 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </div>
        <div>
          <div className="font-black uppercase text-[10px] tracking-widest leading-none">System Offline</div>
          <div className="text-[9px] font-bold opacity-90 mt-1 uppercase">Attempting to reconnect...</div>
        </div>
      </div>
    </div>
  );
};

const SettingsForm = ({ tournament, onSubmit, onDelete }) => {
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    const teams = data.teams.split('\n').filter(t => t.trim().length > 0);

    if (teams.length < 2) {
      setError("You need at least 2 teams to create a bracket.");
      setIsSubmitting(false);
      return;
    }

    try {
      if (tournament) await api.put(`/tournaments/${tournament.id}`, data);
      else await api.post('/tournaments', data);
      onSubmit();
    } catch (err) { setError(typeof err.detail === 'string' ? err.detail : "Error saving tournament"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-xs text-red-500 dark:text-red-400 text-center mb-4 bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-200 dark:border-red-900/30">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase">Name</label>
          <input
            name="name"
            defaultValue={tournament?.name}
            required
            placeholder="My Awesome Tournament"
            autoFocus
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-600 rounded p-2 focus:border-orange-500 outline-none transition text-zinc-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-zinc-500 text-xs uppercase">Code</label>
            <input
              name="code"
              defaultValue={tournament?.code}
              required
              placeholder="••••"
              autoComplete="off"
              className="w-full h-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-center font-mono focus:border-orange-500 outline-none transition text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="font-bold text-zinc-500 text-xs uppercase">Type</label>
            <select
              name="type"
              defaultValue={tournament?.type || "double"}
              className="w-full h-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-600 rounded p-2 focus:border-orange-500 outline-none transition text-zinc-900 dark:text-white"
            >
              <option value="double">Double Elimination</option>
              <option value="single">Single Elimination</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Duration</label>
            <input
              type="number"
              name="duration"
              defaultValue={tournament?.match_duration || 30}
              min="0"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-600 rounded p-2 h-10 text-base appearance-none focus:border-orange-500 outline-none transition text-zinc-900 dark:text-white"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Start Time</label>
            <input
              type="time"
              name="start_time"
              defaultValue={tournament?.start_time || "09:00"}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-600 rounded p-2 h-10 text-base appearance-none focus:border-orange-500 outline-none transition text-zinc-900 dark:text-white"
            />
          </div>
          <div className="col-span-3">
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Date</label>
            <input
              type="date"
              name="date"
              defaultValue={tournament?.date || new Date().toISOString().split('T')[0]}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded p-2 h-10 text-base appearance-none focus:border-orange-500 outline-none transition text-zinc-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase">Courts</label>
          <input
            name="courts"
            placeholder="Center Court, Court 1"
            defaultValue={tournament?.courts?.join(', ')}
            required
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-600 rounded p-2 focus:border-orange-500 outline-none transition text-zinc-900 dark:text-white"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase">Teams</label>
          <textarea
            name="teams"
            placeholder="One team per line..."
            defaultValue={tournament?.teams?.join('\n')}
            rows={5}
            required
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-600 rounded p-2 font-mono text-sm focus:border-orange-500 outline-none transition text-zinc-900 dark:text-white resize-none"
          />
        </div>
      </div>

      <div className="flex justify-between mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex-wrap gap-y-4">
        {tournament && (
          <button
            type="button"
            onClick={() => onDelete(tournament.id)}
            className="text-red-500 text-sm hover:underline h-5 self-end"
          >
            Delete Tournament
          </button>
        )}
        {!tournament && <div className="hidden"></div>}

        <button
          disabled={isSubmitting}
          type="submit"
          className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded font-bold shadow-lg shadow-orange-900/20 ml-auto transition active:scale-95"
        >
          {isSubmitting ? 'Saving...' : (tournament ? 'Save Changes' : 'Create')}
        </button>
      </div>
    </form>
  );
};

const ScoreForm = ({ match, isAdmin, onSubmit, onClear }) => {
  const [sets, setSets] = useState(match.sets.length ? match.sets : [{ p1: '', p2: '' }]);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    try { await onSubmit(match.id, sets, code); }
    catch (err) { setError(typeof err.detail === 'string' ? err.detail : "Check code or scores"); }
  };

  const removeSet = (idx) => {
    if (sets.length > 1) setSets(sets.filter((_, i) => i !== idx));
  };

  const updateSet = (idx, field, val) => {
    const n = [...sets];
    n[idx][field] = parseInt(val) || 0;
    setSets(n);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center items-center gap-4 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm transition-colors">
        <div className="flex items-center gap-2 text-sm font-mono text-zinc-600 dark:text-zinc-300">
          <ClockIcon weight="duotone" className="text-orange-500" size={18} />
          <span>{match.time || "10:00"}</span>
        </div>
        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800" />
        <div className="flex items-center gap-2 text-sm font-mono text-zinc-900 dark:text-white">
          <CourtBasketballIcon weight="duotone" className="text-orange-500" size={18} />
          <span>{match.court || "Plan Z"}</span>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-500 dark:text-red-400 text-center bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-200 dark:border-red-900/30">
          {error}
        </div>
      )}

      {!isAdmin && (
        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-gray-200 dark:border-zinc-800">
          <label className="block text-xs font-bold text-orange-500 uppercase mb-2">Tournament Code</label>
          <input
            type="password"
            id="scoreCode"
            name="tournament-code"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="•••••"
            autoComplete="off"
            className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded p-3 text-center text-lg tracking-[0.5em] focus:ring-1 focus:ring-orange-500 outline-none transition text-zinc-900 dark:text-white shadow-sm"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center font-bold text-zinc-700 dark:text-zinc-200 items-center px-2">
        <div className="break-words text-sm leading-tight">{match.p1 || match.p1_label}</div>
        <div className="text-zinc-400 dark:text-zinc-600 text-[10px] font-bold uppercase bg-zinc-100 dark:bg-zinc-950 px-3 py-1 rounded-full w-fit mx-auto shadow-sm">VS</div>
        <div className="break-words text-sm leading-tight">{match.p2 || match.p2_label}</div>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {sets.map((s, i) => (
          <div key={i} className="animate-in slide-in-from-top-1 px-1">
            <div className="flex items-center justify-center gap-2">
              <div className="grid grid-cols-3 gap-2 items-center justify-items-center">
                <input
                  type="number"
                  min="0"
                  pattern="[0-9]*"
                  value={s.p1}
                  onChange={(e) => updateSet(i, "p1", e.target.value)}
                  className="sp1 w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 p-2 rounded text-center focus:border-orange-500 outline-none text-zinc-900 dark:text-white"
                />

                {sets.length > 1 ? (
                  <button
                    onClick={() => removeSet(i)}
                    title="Remove Set"
                    className="mx-auto p-2 text-zinc-300 hover:text-red-500 transition shrink-0 group"
                  >
                    <EraserIcon
                      weight="duotone"
                      size={18}
                      className="group-hover:scale-110 transition-transform"
                    />
                  </button>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-600 text-center font-bold">
                    -
                  </span>
                )}

                <input
                  type="number"
                  min="0"
                  pattern="[0-9]*"
                  value={s.p2}
                  onChange={(e) => updateSet(i, "p2", e.target.value)}
                  className="sp2 w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 p-2 rounded text-center focus:border-orange-500 outline-none text-zinc-900 dark:text-white"
                />
              </div>

            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setSets([...sets, { p1: '', p2: '' }])} className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-sm hover:border-orange-500 hover:text-orange-500 transition rounded">+ Add Set</button>

      <div className="flex gap-2">
        {match.winner && (
          <button
            onClick={() => onClear(match.id, code)}
            className="w-1/3 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 text-red-600 dark:text-red-300 py-3 rounded-lg font-bold transition text-sm"
          >
            Clear
          </button>
        )}
        <button
          onClick={handleSubmit}
          className={`${match.winner ? 'w-2/3' : 'w-full'} bg-orange-600 hover:bg-orange-500 py-3 rounded-lg font-bold shadow-lg shadow-orange-900/20 transition text-white active:scale-95`}
        >
          Submit Result
        </button>
      </div>
    </div>
  );
};

// --- BRACKET VIEW ---
const BracketView = ({ matches, onMatchClick }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;
    const container = containerRef.current.getBoundingClientRect();
    const svg = svgRef.current;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    matches.forEach(m => {
      const sEl = document.getElementById(`match-${m.id}`);
      const eEl = document.getElementById(`match-${m.next_win}`);

      if (sEl && eEl && sEl.offsetParent !== null && eEl.offsetParent !== null) {
        const r1 = sEl.getBoundingClientRect(), r2 = eEl.getBoundingClientRect();
        const sx = r1.right - container.left, sy = r1.top + r1.height / 2 - container.top;
        const ex = r2.left - container.left, ey = r2.top + r2.height / 2 - container.top;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const c1 = sx + (ex - sx) / 2;
        path.setAttribute("d", `M ${sx} ${sy} C ${c1} ${sy}, ${c1} ${ey}, ${ex} ${ey}`);
        path.setAttribute("class", "stroke-zinc-500 dark:stroke-zinc-400 fill-none stroke-[2px] opacity-40");
        svg.appendChild(path);
      }
    });
  }, [matches]);

  const renderTree = (list, align = 'justify-center') => {
    const rounds = {};
    list.forEach(m => { if (!rounds[m.round]) rounds[m.round] = []; rounds[m.round].push(m); });

    return Object.keys(rounds)
      .sort((a, b) => a - b)
      .filter(r => rounds[r].some(m => m.number))
      .map(r => (
        <div key={r} className={`flex flex-col ${align} gap-12 min-w-[280px] z-10`}>
          {rounds[r].sort((a, b) => parseInt(a.id) - parseInt(b.id)).map(m => (
            <MatchCard key={m.id} match={m} onClick={() => onMatchClick(m)} />
          ))}
        </div>
      ));
  };

  const wb = matches.filter(m => m.bracket === 'winners');
  const lb = matches.filter(m => m.bracket === 'losers');
  const finals = matches.filter(m => m.bracket === 'finals');

  return (
    <div className="w-full h-full overflow-auto p-8 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] dark:bg-[radial-gradient(#18181b_1px,transparent_1px)] [background-size:20px_20px]">
      <div ref={containerRef} className="relative min-w-max p-4 flex gap-24">
        <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

        <div className="flex flex-col gap-24">
          <div className="relative flex gap-16">
            <div className="absolute -top-10 left-0 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-600">Winners Bracket</div>
            {renderTree(wb)}
          </div>

          {lb.length > 0 && (
            <div className="relative flex flex-col gap-12 pt-16 border-t border-zinc-300 dark:border-zinc-800 w-full">
              <div className="absolute top-6 left-0 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-600">Losers Bracket</div>
              <div className="flex gap-16 justify-start">{renderTree(lb, 'justify-start')}</div>
            </div>
          )}
        </div>

        {finals.length > 0 && (
          <div className="flex flex-col justify-center items-center gap-4 relative z-10 min-w-[280px]">
            <div className="absolute top-1/2 -translate-y-[calc(50%+80px)] flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-200 dark:border-orange-800 shadow-sm">
              <TrophyIcon weight="duotone" size={14} /> Championship
            </div>
            {finals.map(m => <MatchCard key={m.id} match={m} onClick={() => onMatchClick(m)} />)}
          </div>
        )}
      </div>
    </div>
  );
};

const MatchCard = ({ match, onClick }) => {
  if (!match.number) return <div id={`match-${match.id}`} className="hidden" />;

  const isFinished = match.status === "Finished";
  const p1Winner = isFinished && match.winner === match.p1 && match.p1 && match.p1 !== "BYE";
  const p2Winner = isFinished && match.winner === match.p2 && match.p2 && match.p2 !== "BYE";

  const borderColor = isFinished
    ? 'border-orange-500 ring-4 ring-orange-500/10'
    : 'border-zinc-300 dark:border-zinc-700';

  const badgeColor = match.time ? stringToColor(match.court) : null;

  return (
    <div
      id={`match-${match.id}`}
      onClick={() => (match.p1 && match.p2) && onClick(match)}
      className={`w-64 bg-white dark:bg-zinc-900 rounded-xl border-2 ${borderColor} shadow-sm cursor-pointer hover:-translate-y-1 transition duration-200 group overflow-hidden`}
    >
      <div className="bg-zinc-50 dark:bg-zinc-950/50 px-3 py-2 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-black text-zinc-500 dark:text-zinc-500 uppercase"># {match.number}</span>
          {match.time && <span className="text-[9px] font-black text-white px-1.5 py-0.5 rounded uppercase" style={{ background: badgeColor }}>{match.court}</span>}
        </div>
        {match.winner ? <CheckCircleIcon weight="duotone" className="text-orange-500" size={14} strokeWidth={4} /> : <span className="text-[10px] font-black text-zinc-800 dark:text-zinc-300 font-mono">{match.time || 'TBD'}</span>}
      </div>
      <div className="p-3 space-y-1.5">
        <div className={`flex justify-between items-center ${p1Winner ? 'text-orange-600 dark:text-orange-500 font-black' : 'text-zinc-900 dark:text-zinc-400 font-bold'}`}>
          <span className="truncate text-xs tracking-tight">{match.p1 || <span className="italic opacity-50 font-normal">{match.p1_label}</span>}</span>
          <span className="bg-gray-100 dark:bg-zinc-950 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-black">{match.p1_sets}</span>
        </div>
        <div className={`flex justify-between items-center ${p2Winner ? 'text-orange-600 dark:text-orange-500 font-black' : 'text-zinc-900 dark:text-zinc-400 font-bold'}`}>
          <span className="truncate text-xs tracking-tight">{match.p2 || <span className="italic opacity-50 font-normal">{match.p2_label}</span>}</span>
          <span className="bg-gray-100 dark:bg-zinc-950 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-black">{match.p2_sets}</span>
        </div>
      </div>
    </div>
  );
};

// --- SCHEDULE VIEW ---
const ScheduleView = ({ schedule, onMatchClick }) => {
  const [filter, setFilter] = useState("");
  const filtered = schedule.filter(m =>
    (m.p1 || m.p1_label).toLowerCase().includes(filter.toLowerCase()) ||
    (m.p2 || m.p2_label).toLowerCase().includes(filter.toLowerCase()) ||
    ("#" + m.number.toString() || m.number.toString()).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="h-full overflow-hidden relative flex flex-col">
      {/* STICKY SEARCH BAR */}
      <div className="absolute top-0 inset-x-0 z-30 p-6 pb-2 bg-transparent pointer-events-none">
        <div className="relative group max-w-3xl mx-auto w-full pointer-events-auto">
          <input
            placeholder="Search teams..."
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 pl-12 outline-none focus:ring-2 focus:ring-orange-500 transition shadow-sm text-zinc-900 dark:text-white font-bold"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <MagnifyingGlassIcon weight="duotone" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition" size={20} />
        </div>
      </div>

      {/* MASKED SCROLL LIST */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pt-28 pb-32 [mask-image:linear-gradient(to_bottom,transparent_0px,transparent_60px,black_110px)]">
        <div className="max-w-4xl mx-auto w-full space-y-3">
          {filtered.map(m => {
            const isFinished = m.status === "Finished";
            const p1Winner = isFinished && m.winner === m.p1 && m.p1 && m.p1 !== "BYE";
            const p2Winner = isFinished && m.winner === m.p2 && m.p2 && m.p2 !== "BYE";
            const courtColor = stringToColor(m.court + 'salt');

            return (
              <div
                key={m.id}
                className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm flex items-center justify-between group transition-all hover:border-orange-500/30"
              >
                <div className="flex gap-4 md:gap-6 items-center flex-1 min-w-0">
                  {/* LEFT METADATA COLUMN - STACKED 3 ITEMS ON MOBILE */}
                  <div className="text-center min-w-[65px] md:min-w-[75px] flex flex-col gap-1 items-center shrink-0">
                    <div className="text-lg md:text-xl font-black font-mono text-zinc-900 dark:text-white leading-none">{m.time}</div>

                    <div className="text-[9px] font-black text-white px-2 py-0.5 rounded uppercase tracking-wider w-full truncate" style={{ background: courtColor }}>
                      {m.court}
                    </div>

                    {/* MOBILE ONLY MATCH # BADGE */}
                    <div className="text-[9px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 px-2 py-0.5 rounded uppercase tracking-wider border border-zinc-200 dark:border-zinc-700 w-full md:hidden">
                      Match #{m.number}
                    </div>
                  </div>

                  {/* TEAM LIST COLUMN - STACKED ON MOBILE WITH VS, INLINE ON DESKTOP */}
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 min-w-0">
                      {/* Team 1 Container */}
                      <div className="flex items-center gap-2 min-w-0">
                        {p1Winner && <TrophyIcon weight="duotone" size={14} className="text-orange-500 shrink-0" />}
                        <span className={`truncate text-sm md:text-base font-bold ${p1Winner ? 'text-orange-600 dark:text-orange-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
                          {m.p1 || <span className="italic opacity-50 font-normal">{m.p1_label}</span>}
                        </span>
                      </div>

                      {/* VS SEPARATOR (Line on mobile, Text on Desktop) */}
                      <div className="flex items-center justify-start md:block shrink-0 h-4 md:h-auto">
                        <span className="text-zinc-400 dark:text-zinc-600 text-[9px] font-bold uppercase md:hidden tracking-widest opacity-40">vs</span>
                        <span className="hidden md:block text-zinc-300 dark:text-zinc-700 text-xs font-black px-1">VS</span>
                      </div>

                      {/* Team 2 Container */}
                      <div className="flex items-center gap-2 min-w-0">
                        {p2Winner && <TrophyIcon weight="duotone" size={14} className="text-orange-500 shrink-0" />}
                        <span className={`truncate text-sm md:text-base font-bold ${p2Winner ? 'text-orange-600 dark:text-orange-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
                          {m.p2 || <span className="italic opacity-50 font-normal">{m.p2_label}</span>}
                        </span>
                      </div>
                    </div>

                    {/* DESKTOP ONLY MATCH # BADGE - PLACED UNDERNEATH INLINE TEAMS */}
                    <div className="hidden md:block text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 px-2 py-0.5 rounded uppercase tracking-widest border border-zinc-200 dark:border-zinc-700 w-fit">
                      Match #{m.number}
                    </div>
                  </div>
                </div>

                {/* ACTION AREA - NO CHEVRON, SYMMETRICAL STACKING ON MOBILE */}
                <div className="ml-3 flex items-center shrink-0">
                  {isFinished ? (
                    <button
                      onClick={() => onMatchClick(m)}
                      className="text-right flex flex-col items-center md:items-end hover:bg-zinc-50 dark:hover:bg-zinc-800 p-2 rounded-xl transition group/btn min-w-[30px] md:min-w-[80px]"
                    >
                      {/* VERTICAL SCORE STACK - ALIGNS WITH TEAM NAMES ON MOBILE */}
                      <div className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-[10px] font-black font-mono border border-zinc-200 dark:border-zinc-700 mb-auto md:hidden">
                        {m.p1_sets}
                      </div>

                      <div className="text-orange-500 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 my-1">
                        <span className="md:hidden inline text-zinc-600"><LineVerticalIcon size={12} strokeWidth={4} /></span>
                        <span className="hidden md:inline"><CheckCircleIcon weight="duotone" size={12} strokeWidth={4} /></span><span className="hidden md:inline">Finished</span>
                      </div>

                      <div className="hidden md:block text-sm font-black font-mono text-zinc-900 dark:text-zinc-300 group-hover/btn:text-orange-600 transition-colors">
                        {m.p1_sets} - {m.p2_sets}
                      </div>

                      <div className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-[10px] font-black font-mono border border-zinc-200 dark:border-zinc-700 mt-auto md:hidden">
                        {m.p2_sets}
                      </div>
                    </button>
                  ) : (m.p1 && m.p2) && (
                    <button
                      onClick={() => onMatchClick(m)}
                      className="bg-orange-600 hover:bg-orange-500 text-white p-2 md:px-4 md:py-2 rounded-xl shadow-lg shadow-orange-900/20 active:scale-95 transition-all flex items-center gap-2 group/btn"
                    >
                      <PlusIcon weight="bold" size={18} strokeWidth={3} className="group-hover/btn:rotate-90 transition-transform" />
                      <span className="text-xs font-bold uppercase tracking-wider hidden md:inline">Report score</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-20 text-zinc-400 font-black uppercase tracking-widest text-xs">No matching matches found</div>}
        </div>
      </div>
    </div>
  );
};

// --- DASHBOARD COMPONENTS ---

const DashCard = ({ t, isAdmin, onSelect, onEdit }) => (
  <div
    onClick={() => onSelect(t.id)}
    className="block bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-zinc-700 relative group hover:shadow-md hover:scale-[1.02] transition will-change-transform transform-gpu cursor-pointer"
  >
    <div className="flex justify-between items-start mb-4">
      <div>
        <h2 className="text-xl font-bold truncate text-zinc-900 dark:text-white group-hover:text-orange-500 dark:group-hover:text-orange-400 transition">
          {t.name}
        </h2>
        <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 font-mono">{t.date} {t.start_time}</div>
      </div>
      <span className="bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-[10px] px-2 py-1 rounded font-mono border border-orange-200 dark:border-orange-800 uppercase tracking-tight shrink-0">
        {t.type}
      </span>
    </div>
    <div className="flex gap-4 text-sm text-zinc-500 dark:text-zinc-400 items-center">
      <div className="flex items-center gap-1.5 font-medium"><UsersFourIcon weight="duotone" size={16} className="text-orange-500" /> {t.team_count} Teams</div>
      <div className="flex items-center gap-1.5 font-medium"><CourtBasketballIcon weight="duotone" size={16} className="text-orange-500" /> {t.court_count} Courts</div>
      {isAdmin && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(t.id); }}
          className="ml-auto hover:text-orange-500 transition z-10 h-8 w-8 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          title="Tournament Settings"
        >
          <SlidersHorizontalIcon weight="duotone" size={18} />
        </button>
      )}
    </div>
  </div>
);

const Dashboard = ({ data, onSelect, onEdit, isAdmin, backendDown, isInitialLoad }) => {
  const [showPast, setShowPast] = useState(false);
  const [showAllFuture, setShowAllFuture] = useState(false);

  const future = Object.values(data.future || {});
  const displayedFuture = showAllFuture ? future : future.slice(0, 4);
  const live = Object.values(data.live || {});
  const past = Object.values(data.past || {});

  return (
    <div className="space-y-12 pb-24 animate-in slide-in-from-bottom-4 duration-500 px-4">
      <ConnectivityAlert backendDown={backendDown} isInitialLoad={isInitialLoad} />

      {live.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <VolleyballIcon size={16} className="text-green-500 animate-pulse" />
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Live Now</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {live.map(t => <DashCard key={t.id} t={t} isAdmin={isAdmin} onSelect={onSelect} onEdit={onEdit} />)}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-4">
          <CalendarBlankIcon weight='bold' size={16} className="text-zinc-500" />
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Upcoming</h3>
        </div>
        {future.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedFuture.map(t => <DashCard key={t.id} t={t} isAdmin={isAdmin} onSelect={onSelect} onEdit={onEdit} />)}
            </div>
            {future.length > 4 && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowAllFuture(!showAllFuture)}
                  className="text-sm text-zinc-500 hover:text-orange-500 font-medium transition flex items-center justify-center gap-1 mx-auto w-full py-2 bg-white dark:bg-zinc-800 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm transition active:scale-95"
                >
                  {showAllFuture ? 'Show Less' : `Show All (${future.length})`}
                  {showAllFuture ? <CaretUpIcon weight="bold" size={16} /> : <CaretDownIcon weight="bold" size={16} />}
                </button>
              </div>
            )}
          </>
        ) : <div className="p-12 text-center rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-widest">No scheduled events</div>}
      </section>

      {past.length > 0 && (
        <section>
          <button
            onClick={() => setShowPast(!showPast)}
            className="w-full flex items-center justify-between group mb-4 focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <ClockCounterClockwiseIcon weight='bold' size={16} className={`transition-colors ${showPast ? 'text-orange-500' : 'text-zinc-500'}`} />
              <h3 className="text-sm font-bold text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 uppercase tracking-wider transition">Archive</h3>
            </div>
            {showPast ? <CaretUpIcon weight="bold" size={18} className="text-zinc-400 group-hover:text-orange-500 transition" /> : <CaretDownIcon weight="bold" size={18} className="text-zinc-400 group-hover:text-orange-500 transition" />}
          </button>

          {showPast && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75 hover:opacity-100 transition duration-300">
              {past.map(t => <DashCard key={t.id} t={t} isAdmin={isAdmin} onSelect={onSelect} onEdit={onEdit} />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('id') ? 'tournament' : (localStorage.getItem('volleyViewMode') || 'dashboard');
  });
  const [tId, setTId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || (localStorage.getItem('volleySelectedId') || null);
  });
  const [data, setData] = useState({ live: {}, future: {}, past: {} });
  const [tData, setTData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [tab, setTab] = useState(() => localStorage.getItem('volleyViewTab') || 'bracket');
  const [isAdmin, setIsAdmin] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.theme === 'dark');
  const [backendDown, setBackendDown] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [scoreMatch, setScoreMatch] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  const tIdRef = useRef(tId);
  useEffect(() => {
    tIdRef.current = tId;
    if (tId) {
      localStorage.setItem('volleySelectedId', tId);
      const url = new URL(window.location);
      url.searchParams.set('id', tId);
      window.history.replaceState({}, '', url);
    } else {
      localStorage.removeItem('volleySelectedId');
      const url = new URL(window.location);
      url.searchParams.delete('id');
      window.history.replaceState({}, '', url);
    }
  }, [tId]);

  useEffect(() => { localStorage.setItem('volleyViewMode', view); }, [view]);
  useEffect(() => { localStorage.setItem('volleyViewTab', tab); }, [tab]);

  useEffect(() => {
    const startup = async () => {
      setIsLoading(true);
      try {
        await Promise.all([checkAuth(), loadDashboard()]);
        if (tIdRef.current) await fetchTournament(tIdRef.current);
        setBackendDown(false);
      } catch (e) {
        if (e.detail === "network_error") setBackendDown(true);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };
    startup();

    let ws;
    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'dashboard_update') loadDashboard();
          if (msg.type === 'tournament_update' && msg.id === tIdRef.current) fetchTournament(msg.id);
        };
        ws.onclose = () => {
          setBackendDown(true);
          setTimeout(connect, 5000);
        };
      } catch (err) {
        setBackendDown(true);
        setTimeout(connect, 5000);
      }
    };
    connect();
    return () => { if (ws) ws.close(); };
  }, []);

  useEffect(() => {
    const monitor = setInterval(() => {
      if (backendDown) {
        checkAuth();
        loadDashboard();
        if (tIdRef.current) fetchTournament(tIdRef.current);
      } else {
        if (!isLoading) checkAuth();
      }
    }, 5000);
    return () => clearInterval(monitor);
  }, [backendDown, isLoading]);

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      root.style.backgroundColor = '#09090b';
      body.style.backgroundColor = '#09090b';
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      root.style.backgroundColor = '#fafafa';
      body.style.backgroundColor = '#fafafa';
    }
  }, [darkMode]);

  useEffect(() => {
    // Dynamic tab title handling
    if (view === 'tournament' && tData) {
      document.title = `${tData.tournament.name} | VolleyManager`;
    } else {
      document.title = "VolleyManager";
    }
  }, [view, tData]);

  const checkAuth = async () => {
    if (getToken()) {
      try {
        const res = await api.get('/auth/check');
        setIsAdmin(res.is_admin);
        setBackendDown(false);
      }
      catch (e) {
        setIsAdmin(false);
        if (e.detail === "network_error") setBackendDown(true);
      }
    } else {
      try { await api.get('/tournaments'); setBackendDown(false); }
      catch (e) { if (e.detail === "network_error") setBackendDown(true); }
    }
  };

  const loadDashboard = async () => {
    try {
      const res = await api.get('/tournaments');
      setData(res);
      setBackendDown(false);
    } catch (e) {
      if (e.detail === "network_error") setBackendDown(true);
    }
  };

  const fetchTournament = async (id) => {
    try {
      const res = await api.get(`/tournaments/${id}`);
      setTData(prev => JSON.stringify(prev) === JSON.stringify(res) ? prev : res);
      setBackendDown(false);
    } catch (e) {
      if (e.detail === "network_error") setBackendDown(true);
      else if (e.detail && e.detail.includes("Not found")) {
        setTId(null);
        setView('dashboard');
      }
    }
  };

  useEffect(() => {
    if (tId) { setIsLoading(true); fetchTournament(tId).finally(() => setIsLoading(false)); }
    else setTData(null);
  }, [tId]);

  const openCreate = () => { setEditTarget(null); setShowSettings(true); };
  const openEdit = async (id) => {
    try {
      const res = await api.get(`/tournaments/${id}`);
      setEditTarget(res.tournament);
      setShowSettings(true);
    } catch (e) { }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.postForm('/auth/token', new FormData(e.target));
      localStorage.setItem('volleyToken', res.access_token);
      setIsAdmin(true); setShowLogin(false);
      setBackendDown(false);
    } catch (err) {
      if (err.detail === "network_error") setBackendDown(true);
      else alert("Login failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('volleyToken');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors selection:bg-orange-500/30 flex flex-col overflow-hidden">
      {/* Navbar */}
      <nav className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-b border-zinc-300 dark:border-zinc-800 sticky top-0 z-[100] px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center shadow-md shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 cursor-pointer group select-none shrink-0" onClick={() => { setView('dashboard'); setTId(null); }}>
          <div className="p-1.5 sm:p-2.5 bg-orange-600 rounded-xl group-hover:rotate-12 transition-transform shadow-lg shadow-orange-600/30 active:scale-90">
            <VolleyballIcon className="text-white" size={20} />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-2xl font-black tracking-tighter leading-none text-zinc-900 dark:text-white">VolleyManager</h1>
            <p className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mt-0.5">Tournament Ops</p>
          </div>
        </div>

        {/* Center Title */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none w-full max-w-[140px] xs:max-w-[180px] sm:max-w-[400px]">
          <div className="font-black uppercase text-[10px] sm:text-sm text-zinc-900 dark:text-white truncate tracking-widest leading-none mb-1">
            {view === 'tournament' ? tData?.tournament.name : 'Dashboard'}
          </div>
          {view === 'tournament' && tData && (
            <div className="text-[8px] sm:text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest leading-none">
              {tData.tournament.date}
            </div>
          )}
        </div>

        <div className="flex gap-2 sm:gap-4 items-center shrink-0">
          {isAdmin ? (
            <>
              {view === 'dashboard' ? (
                <button onClick={openCreate} className="bg-orange-600 hover:bg-orange-500 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl flex items-center gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-[0.2em] transition shadow-xl shadow-orange-600/20 active:scale-95 shrink-0">
                  <PlusIcon weight="bold" size={16} strokeWidth={4} /> <span className="hidden xs:inline">Create</span>
                </button>
              ) : (
                <button onClick={() => openEdit(tId)} className="text-zinc-500 hover:text-orange-500 transition p-2 sm:p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl active:scale-90">
                  <SlidersHorizontalIcon weight="duotone" size={18} sm:size={22} strokeWidth={2.5} />
                </button>
              )}
              <div className="w-px h-5 sm:h-6 bg-zinc-200 dark:bg-zinc-800 mx-0.5 sm:mx-1" />
              <button onClick={handleLogout} title="Sign Out" className="text-zinc-400 hover:text-red-500 transition active:scale-90 shrink-0"><SignOutIcon weight='duotone' size={18} sm:size={22} /></button>
            </>
          ) : (
            <button onClick={() => setShowLogin(true)} className="ml-auto hover:text-orange-500 transition z-10 h-8 w-8 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700">
              <SignInIcon weight='duotone' size={18} />
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 overflow-hidden relative">
        {view === 'dashboard' ? (
          <div className="h-full overflow-y-auto pt-8 sm:pt-12">
            <div className="container mx-auto max-w-5xl">
              <Dashboard data={data} onSelect={(id) => { setTId(id); setView('tournament'); }} onEdit={openEdit} isAdmin={isAdmin} backendDown={backendDown} isInitialLoad={isInitialLoad} />
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col overflow-hidden relative">
            <ConnectivityAlert backendDown={backendDown} isInitialLoad={isInitialLoad} />

            {isLoading && !tData ? (
              <div className="flex items-center justify-center h-full flex-col gap-6">
                <div className="relative">
                  <VolleyballIcon className="text-orange-100 dark:text-zinc-900" size={80} />
                  <CircleNotchIcon weight="bold" className="animate-spin text-orange-600 absolute inset-0 m-auto" size={48} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">Syncing Bracket State...</span>
              </div>
            ) : tData && (
              <div className="flex-1 overflow-hidden relative">
                {tab === 'bracket' ? <BracketView matches={tData.tournament.matches} onMatchClick={setScoreMatch} /> : <ScheduleView schedule={tData.schedule} onMatchClick={setScoreMatch} />}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 sm:bottom-8 right-6 sm:right-8 flex flex-col gap-3 sm:gap-4 z-40">
        {view === 'tournament' && (
          <button onClick={() => setTab(tab === 'bracket' ? 'schedule' : 'bracket')} className="p-4 sm:p-5 bg-orange-600 text-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl transition hover:scale-110 active:scale-95 shadow-orange-900/40 border-2 border-orange-400/20 group relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            {tab === 'bracket' ? <CalendarDotsIcon weight='duotone' size={24} strokeWidth={3} className="sm:size-7" /> : <TreeStructureIcon weight="duotone" size={24} strokeWidth={3} className="sm:size-7" />}
          </button>
        )}
        <button onClick={() => setDarkMode(!darkMode)} title="Toggle Theme" className="p-4 sm:p-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl transition hover:scale-110 active:scale-95 border-2 border-zinc-700 dark:border-zinc-300 group">
          {darkMode ? <SunIcon weight="duotone" size={24} strokeWidth={2.5} className="sm:size-7" /> : <MoonIcon weight='duotone' size={24} strokeWidth={2.5} className="sm:size-7" />}
        </button>
      </div>

      {/* Modals */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title={editTarget ? 'Settings' : 'New Tournament'}
        icon={editTarget ? SlidersHorizontalIcon : PlusIcon}
        customWidth="max-w-lg"
      >
        <SettingsForm
          tournament={editTarget}
          onSubmit={() => { setShowSettings(false); loadDashboard(); }}
          onDelete={async (id) => { if (window.confirm("Purge this tournament and all its history?")) { await api.delete(`/tournaments/${id}`); setShowSettings(false); setView('dashboard'); loadDashboard(); } }}
        />
      </Modal>

      <Modal isOpen={!!scoreMatch} onClose={() => setScoreMatch(null)} customWidth="max-w-md">
        {scoreMatch && (
          <div className="p-0">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl flex items-center gap-2 text-zinc-900 dark:text-white leading-none">
                <TrophyIcon weight="duotone" className="text-orange-500" size={24} />
                Match #{scoreMatch.number || "?"}
              </h3>
              <button onClick={() => setScoreMatch(null)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition">
                <XIcon size={24} />
              </button>
            </div>
            <ScoreForm
              match={scoreMatch}
              isAdmin={isAdmin}
              onClear={async (id, c) => { await api.post(`/tournaments/${tId}/report`, { id, code: c, clear: true }); setScoreMatch(null); }}
              onSubmit={async (id, s, c) => { await api.post(`/tournaments/${tId}/report`, { id, sets: s, code: c }); setScoreMatch(null); }}
            />
          </div>
        )}
      </Modal>

      <Modal isOpen={showLogin} onClose={() => setShowLogin(false)} customWidth="max-w-md">
        <div className="p-0">
          <div className="flex justify-center mb-4">
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-2 rounded-full">
              <SignInIcon weight='duotone' className="text-orange-500" size={24} />
            </div>
          </div>
          <h2 className="text-lg font-bold mb-4 text-center text-zinc-900 dark:text-white leading-none">Admin Login</h2>
          <form onSubmit={handleLogin} className="space-y-3" autoComplete="on">
            <input
              id="login-username"
              name="username"
              placeholder="Username"
              autofocus
              required
              autoComplete="username"
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded p-3 focus:border-orange-500 outline-none transition text-zinc-900 dark:text-white"
            />
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="Password"
              required
              autoComplete="current-password"
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded p-3 mb-6 focus:border-orange-500 outline-none transition text-zinc-900 dark:text-white"
            />
            <div className="flex justify-between items-center pt-3">
              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="px-3 py-1 text-zinc-400 text-sm hover:text-zinc-600 dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-1 rounded font-bold shadow-lg shadow-orange-900/20 active:scale-95 transition"
              >
                Login
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}