import React, { useState, useEffect, useRef } from 'react';
import {
  Volleyball, CalendarDays, Network, Moon, Sun,
  Plus, SlidersHorizontal, X, Trophy, Lock, LogOut,
  Calendar, History, Search, Trash2, Users,
  Check, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

// --- DYNAMIC API CONFIGURATION ---
const getBackendHost = () => {
  const host = window.location.hostname || 'localhost';
  return host;
};

const API_BASE = `${window.location.protocol}//${getBackendHost()}:8080`;
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${getBackendHost()}:8080/ws`;

const getToken = () => localStorage.getItem('volleyToken');

const api = {
  request: async (method, url, data = null, isFormData = false) => {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const opts = { method, headers };
    if (data) opts.body = isFormData ? data : JSON.stringify(data);
    const res = await fetch(`${API_BASE}${url}`, opts);
    if (!res.ok) {
      if (res.status === 401) localStorage.removeItem('volleyToken');
      throw await res.json();
    }
    return res.json();
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
  const salt = 'volley-standard-salt-v5';
  const COURT_COLORS = ['#ea580c', '#0284c7', '#059669', '#ca8a04', '#dc2626', '#0891b2', '#e11d48', '#65a30d'];
  let hash = 0;
  const combined = normalized + salt;
  for (let i = 0; i < combined.length; i++) hash = combined.charCodeAt(i) + ((hash << 5) - hash);
  return COURT_COLORS[Math.abs(hash) % COURT_COLORS.length];
};

// --- UI COMPONENTS ---

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-300 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">{title}</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    const teams = data.teams.split('\n').filter(t => t.trim().length > 0);
    if (teams.length < 2) { setError("At least 2 teams required."); setIsSubmitting(false); return; }

    try {
      if (tournament) await api.put(`/tournaments/${tournament.id}`, data);
      else await api.post('/tournaments', data);
      onSubmit();
    } catch (err) { setError(typeof err.detail === 'string' ? err.detail : "Error saving"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-center text-sm font-bold border border-red-100">{error}</div>}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Name</label>
        <input name="name" defaultValue={tournament?.name} required className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-3 rounded-xl dark:text-white outline-none focus:border-orange-500 font-bold" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Access Code</label>
          <input name="code" defaultValue={tournament?.code} required className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-3 rounded-xl text-center font-mono dark:text-white font-bold" />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Type</label>
          <select name="type" defaultValue={tournament?.type || "double"} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-3 rounded-xl dark:text-white outline-none font-bold">
            <option value="double">Double Elimination</option>
            <option value="single">Single Elimination</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <input type="number" name="duration" placeholder="Min" defaultValue={tournament?.match_duration || 30} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-3 rounded-xl dark:text-white font-bold" />
        <input type="time" name="start_time" defaultValue={tournament?.start_time || "09:00"} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-3 rounded-xl dark:text-white font-bold" />
        <input type="date" name="date" defaultValue={tournament?.date || new Date().toISOString().split('T')[0]} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-3 rounded-xl dark:text-white font-bold" />
      </div>
      <input name="courts" placeholder="Courts (e.g. Center, Court 1)" defaultValue={tournament?.courts?.join(', ')} required className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-3 rounded-xl dark:text-white font-bold" />
      <textarea name="teams" placeholder="Teams (one per line)" defaultValue={tournament?.teams?.join('\n')} rows={5} required className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-3 rounded-xl font-mono text-sm dark:text-white font-bold" />
      <div className="flex justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
        {tournament && <button type="button" onClick={() => onDelete(tournament.id)} className="text-red-500 text-sm font-black uppercase tracking-widest hover:underline">Delete Tournament</button>}
        <button disabled={isSubmitting} type="submit" className="bg-orange-600 hover:bg-orange-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition active:scale-95 ml-auto shadow-lg shadow-orange-600/20">
          {isSubmitting ? 'Saving...' : (tournament ? 'Save Changes' : 'Create Tournament')}
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
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-center text-sm font-bold border border-red-100">{error}</div>}

      <div className="flex justify-around items-center bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-inner">
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Time</div>
          <div className="text-xl font-black font-mono text-zinc-900 dark:text-white">{match.time || '--:--'}</div>
        </div>
        <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-800" />
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Court</div>
          <div className="text-xl font-black uppercase text-zinc-900 dark:text-white tracking-tighter flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: stringToColor(match.court) }} />
            {match.court || 'TBD'}
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Authorization</label>
          <input type="password" value={code} onChange={e => setCode(e.target.value)} placeholder="•••••" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-3 rounded-xl text-center tracking-[0.5em] dark:text-white font-bold outline-none focus:border-orange-500" />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center font-black text-zinc-800 dark:text-zinc-200 items-center">
        <div className="text-sm truncate uppercase tracking-tight">{match.p1 || match.p1_label}</div>
        <div className="text-[10px] bg-orange-600 text-white px-3 py-1.5 rounded-full w-fit mx-auto shadow-lg shadow-orange-600/20">VS</div>
        <div className="text-sm truncate uppercase tracking-tight">{match.p2 || match.p2_label}</div>
      </div>

      <div className="space-y-4">
        {sets.map((s, i) => (
          <div key={i} className="animate-in slide-in-from-top-1 px-1">
            <div className="flex items-center gap-4">
              <div className="flex-1 flex items-center gap-3">
                <input type="number" value={s.p1} onChange={e => updateSet(i, 'p1', e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-4 rounded-xl text-center dark:text-white font-black text-xl outline-none focus:border-orange-500 shadow-sm" />
                <div className="w-4 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded-full shrink-0" />
                <input type="number" value={s.p2} onChange={e => updateSet(i, 'p2', e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-4 rounded-xl text-center dark:text-white font-black text-xl outline-none focus:border-orange-500 shadow-sm" />
              </div>
              <button onClick={() => removeSet(i)} title="Remove Set" className="p-3 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition shrink-0 group">
                <Trash2 size={20} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setSets([...sets, { p1: '', p2: '' }])} className="w-full py-4 border-2 border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:border-orange-500 hover:text-orange-500 transition active:bg-orange-50 dark:active:bg-orange-900/10">+ Add Set</button>

      <div className="flex gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        {match.winner && <button onClick={() => onClear(match.id, code)} className="w-1/3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-black uppercase tracking-widest text-[10px] transition active:scale-95 border border-red-200 dark:border-red-900/50">Clear Match</button>}
        <button onClick={handleSubmit} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm shadow-xl shadow-orange-600/20 transition active:scale-95">Submit Result</button>
      </div>
    </div>
  );
};

// --- DASHBOARD COMPONENTS ---

const DashCard = ({ t, isAdmin, onSelect, onEdit }) => (
  <div onClick={() => onSelect(t.id)} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:shadow-2xl hover:-translate-y-1.5 transition-all relative overflow-hidden group">
    <div className="absolute top-0 left-0 w-2 h-full bg-orange-600 group-hover:w-3 transition-all"></div>
    <div className="flex justify-between items-start mb-4">
      <h3 className="font-black text-xl text-zinc-900 dark:text-white truncate pr-4 leading-tight">{t.name}</h3>
      {isAdmin && <button onClick={(e) => { e.stopPropagation(); onEdit(t.id); }} className="text-zinc-300 hover:text-orange-500 transition p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl shrink-0"><SlidersHorizontal size={18} /></button>}
    </div>
    <div className="space-y-2.5">
      <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300 font-bold text-sm tracking-tight">
        <Calendar size={16} className="text-orange-600 shrink-0" />
        <span>{t.date} <span className="text-zinc-300 dark:text-zinc-700 mx-1">/</span> {t.start_time}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300 font-bold text-sm tracking-tight">
          <Users size={16} className="text-orange-600 shrink-0" />
          <span>{t.team_count} Teams</span>
        </div>
        <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-zinc-200 dark:border-zinc-700 text-zinc-500">{t.type}</span>
      </div>
    </div>
  </div>
);

const Dashboard = ({ data, onSelect, onEdit, isAdmin }) => {
  const [showPast, setShowPast] = useState(false);
  const [showAllFuture, setShowAllFuture] = useState(false);

  const futureAll = Object.values(data.future || {});
  const future = showAllFuture ? futureAll : futureAll.slice(0, 4);
  const live = Object.values(data.live || {});
  const past = Object.values(data.past || {});

  return (
    <div className="space-y-16 animate-in slide-in-from-bottom-4 duration-500 px-2">
      {live.length > 0 && (
        <section>
          <h2 className="text-[10px] font-black text-green-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping shadow-lg shadow-green-500/50" /> Live Events
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {live.map(t => <DashCard key={t.id} t={t} isAdmin={isAdmin} onSelect={onSelect} onEdit={onEdit} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
          <Calendar size={18} /> Upcoming
        </h2>
        {futureAll.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {future.map(t => <DashCard key={t.id} t={t} isAdmin={isAdmin} onSelect={onSelect} onEdit={onEdit} />)}
            </div>
            {futureAll.length > 4 && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowAllFuture(!showAllFuture)}
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-orange-500 transition border-b-2 border-transparent hover:border-orange-500 pb-1"
                >
                  {showAllFuture ? 'Show Less' : `Show All (${futureAll.length})`}
                </button>
              </div>
            )}
          </>
        ) : <div className="p-16 text-center rounded-3xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-400 text-xs font-black uppercase tracking-[0.3em]">No Upcoming Events</div>}
      </section>

      {past.length > 0 && (
        <section>
          <button onClick={() => setShowPast(!showPast)} className="w-full flex items-center justify-between group py-6 border-t border-zinc-300 dark:border-zinc-800 transition-colors hover:border-zinc-400">
            <h2 className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.4em] mb-6 flex items-center gap-3"><History size={18} />Archive</h2>
            {showPast ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {showPast && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 opacity-75 hover:opacity-100 transition-opacity">
              {past.map(t => <DashCard key={t.id} t={t} isAdmin={isAdmin} onSelect={onSelect} onEdit={onEdit} />)}
            </div>
          )}
        </section>
      )}
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
        path.setAttribute("class", "stroke-zinc-300 dark:stroke-zinc-800 fill-none stroke-[2px] opacity-40");
        svg.appendChild(path);
      }
    });
  }, [matches]);

  const renderTree = (list, align = 'justify-center') => {
    const rounds = {};
    list.forEach(m => { if (!rounds[m.round]) rounds[m.round] = []; rounds[m.round].push(m); });

    // LOSERS FIX: Filter out rounds that don't have any matches with a 'number'
    // This removes the "ghost columns" pushing the losers bracket right.
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

        {/* Finals - Column separation prevents diagonal wonky lines */}
        {finals.length > 0 && (
          <div className="flex flex-col justify-center items-center gap-4 relative z-10 min-w-[280px]">
            <div className="absolute top-1/2 -translate-y-[calc(50%+140px)] flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-200 dark:border-orange-800 shadow-sm">
              <Trophy size={14} /> Championship
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
  const badgeColor = match.time ? stringToColor(match.court) : null;
  const isPending = !match.p1 || !match.p2;

  return (
    <div
      id={`match-${match.id}`}
      onClick={() => !isPending && onClick(match)}
      className={`w-64 bg-white dark:bg-zinc-900 rounded-xl border-2 ${match.winner ? 'border-orange-500 ring-4 ring-orange-500/10' : 'border-zinc-300 dark:border-zinc-800'} shadow-sm ${!isPending ? 'cursor-pointer hover:-translate-y-1 transition duration-200 group' : 'opacity-80 cursor-default'} overflow-hidden transition-all`}
    >
      <div className="bg-zinc-50 dark:bg-zinc-950/50 px-3 py-2 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-black text-zinc-500 dark:text-zinc-500 uppercase"># {match.number}</span>
          {match.time && <span className="text-[9px] font-black text-white px-1.5 py-0.5 rounded uppercase" style={{ background: badgeColor }}>{match.court}</span>}
        </div>
        {match.winner ? <Check className="text-orange-500" size={14} strokeWidth={4} /> : <span className="text-[10px] font-black text-zinc-800 dark:text-zinc-300 font-mono">{match.time || 'TBD'}</span>}
      </div>
      <div className="p-3 space-y-1.5">
        <div className={`flex justify-between items-center ${match.winner === match.p1 ? 'text-orange-600 dark:text-orange-500 font-black' : 'text-zinc-900 dark:text-zinc-400 font-bold'}`}>
          <span className="truncate text-xs uppercase tracking-tight font-bold">{match.p1 || match.p1_label}</span>
          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px] font-black">{match.p1_sets}</span>
        </div>
        <div className={`flex justify-between items-center ${match.winner === match.p2 ? 'text-orange-600 dark:text-orange-500 font-black' : 'text-zinc-900 dark:text-zinc-400 font-bold'}`}>
          <span className="truncate text-xs uppercase tracking-tight font-bold">{match.p2 || match.p2_label}</span>
          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px] font-black">{match.p2_sets}</span>
        </div>
      </div>
    </div>
  );
};

// --- SCHEDULE VIEW ---
const ScheduleView = ({ schedule, onMatchClick }) => {
  const [filter, setFilter] = useState("");
  const filtered = schedule.filter(m =>
    (m.p1 || "").toLowerCase().includes(filter.toLowerCase()) ||
    (m.p2 || "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden relative flex flex-col">
      {/* STICKY SEARCH BAR */}
      <div className="sticky top-0 z-20 bg-zinc-50 dark:bg-zinc-950 p-6 pb-2">
        <div className="relative group max-w-3xl mx-auto w-full">
          <input
            placeholder="Search teams..."
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 pl-12 outline-none focus:ring-2 focus:ring-orange-500 transition shadow-sm text-zinc-900 dark:text-white font-bold"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition" size={20} />
        </div>
      </div>

      <div className="p-6 pt-2 max-w-4xl mx-auto w-full space-y-3 pb-32">
        {filtered.map(m => (
          <div key={m.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm flex items-center justify-between group transition-all hover:border-orange-500/30">
            <div className="flex gap-6 items-center">
              <div className="text-center min-w-[70px]">
                <div className="text-xl font-black font-mono text-zinc-900 dark:text-white leading-none mb-1">{m.time}</div>
                <div className="text-[9px] font-black text-white px-2 py-0.5 rounded uppercase tracking-wider" style={{ background: stringToColor(m.court) }}>{m.court}</div>
              </div>
              <div>
                <div className="font-black text-base uppercase tracking-tight text-zinc-900 dark:text-zinc-100">
                  {m.p1 || <span className="text-zinc-400 italic lowercase font-medium">{m.p1_label}</span>}
                  <span className="text-zinc-300 dark:text-zinc-700 mx-2 text-xs font-black">VS</span>
                  {m.p2 || <span className="text-zinc-400 italic lowercase font-medium">{m.p2_label}</span>}
                </div>
                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Match #{m.number} • {m.bracket} Round {m.round}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {m.winner ? (
                <div className="text-right shrink-0">
                  <div className="text-orange-500 font-black text-[10px] uppercase tracking-wider mb-0.5">Finished</div>
                  <div className="text-sm font-black font-mono text-zinc-900 dark:text-zinc-300">{m.p1_sets} - {m.p2_sets}</div>
                </div>
              ) : (m.p1 && m.p2) && (
                <button onClick={() => onMatchClick(m)} className="bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase px-5 py-2.5 rounded-xl transition shadow-lg shadow-orange-600/20 active:scale-95 shrink-0">Report</button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-20 text-zinc-400 font-black uppercase tracking-widest text-xs">No matching matches found</div>}
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [view, setView] = useState(() => localStorage.getItem('volleyViewMode') || 'dashboard');
  const [tId, setTId] = useState(() => localStorage.getItem('volleySelectedId') || null);
  const [data, setData] = useState({ live: {}, future: {}, past: {} });
  const [tData, setTData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState(() => localStorage.getItem('volleyViewTab') || 'bracket');
  const [isAdmin, setIsAdmin] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.theme === 'dark');

  const tIdRef = useRef(tId);
  useEffect(() => {
    tIdRef.current = tId;
    if (tId) localStorage.setItem('volleySelectedId', tId);
    else localStorage.removeItem('volleySelectedId');
  }, [tId]);

  useEffect(() => { localStorage.setItem('volleyViewMode', view); }, [view]);
  useEffect(() => { localStorage.setItem('volleyViewTab', tab); }, [tab]);

  useEffect(() => {
    checkAuth();
    loadDashboard();

    // Persistent WebSocket connection
    let ws;
    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'dashboard_update') loadDashboard();
          if (msg.type === 'tournament_update' && msg.id === tIdRef.current) fetchTournament(msg.id);
        };
        ws.onclose = () => setTimeout(connect, 3000);
      } catch (err) { setTimeout(connect, 5000); }
    };
    connect();
    return () => { if (ws) ws.close(); };
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      // FIX FOR IOS WHITE BLEED:
      root.style.backgroundColor = '#09090b'; // zinc-950
      body.style.backgroundColor = '#09090b';
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      root.style.backgroundColor = '#fafafa'; // zinc-50
      body.style.backgroundColor = '#fafafa';
    }
  }, [darkMode]);

  const checkAuth = async () => {
    if (getToken()) {
      try { const res = await api.get('/auth/check'); setIsAdmin(res.is_admin); }
      catch { setIsAdmin(false); }
    }
  };

  const loadDashboard = async () => {
    try { const res = await api.get('/tournaments'); setData(res); } catch (e) { }
  };

  const fetchTournament = async (id) => {
    try {
      const res = await api.get(`/tournaments/${id}`);
      setTData(prev => JSON.stringify(prev) === JSON.stringify(res) ? prev : res);
    } catch (e) { }
  };

  useEffect(() => {
    if (tId) { setIsLoading(true); fetchTournament(tId).finally(() => setIsLoading(false)); }
    else setTData(null);
  }, [tId]);

  const [showSettings, setShowSettings] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [scoreMatch, setScoreMatch] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

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
    } catch { alert("Login failed"); }
  };

  return (
    /* FIXED MAIN CONTAINER: Use absolute positioning to lock iOS browser scroll */
    <div className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors selection:bg-orange-500/30 flex flex-col overflow-hidden">
      {/* Navbar */}
      <nav className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-b border-zinc-300 dark:border-zinc-800 sticky top-0 z-[100] px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center shadow-md shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 cursor-pointer group select-none shrink-0" onClick={() => { setView('dashboard'); setTId(null); }}>
          <div className="p-1.5 sm:p-2.5 bg-orange-600 rounded-xl group-hover:rotate-12 transition-transform shadow-lg shadow-orange-600/30 active:scale-90">
            <Volleyball className="text-white" size={20} />
          </div>
          {/* JUST LOGO ON MOBILE */}
          <div className="hidden sm:block">
            <h1 className="text-2xl font-black tracking-tighter leading-none text-zinc-900 dark:text-white">VolleyManager</h1>
            <p className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mt-0.5">Tournament Ops</p>
          </div>
        </div>

        {/* Center Title - Condensed on mobile */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none w-full max-w-[140px] xs:max-w-[180px] sm:max-w-[400px]">
          <div className="font-black uppercase text-[10px] sm:text-sm tracking-[0.1em] sm:tracking-[0.3em] text-zinc-900 dark:text-white truncate leading-none mb-1">
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
                  <Plus size={16} strokeWidth={4} /> <span className="hidden xs:inline">Create</span>
                </button>
              ) : (
                <button onClick={() => openEdit(tId)} className="text-zinc-500 hover:text-orange-500 transition p-2 sm:p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl active:scale-90">
                  <SlidersHorizontal size={18} sm:size={22} strokeWidth={2.5} />
                </button>
              )}
              <div className="w-px h-5 sm:h-6 bg-zinc-200 dark:bg-zinc-800 mx-0.5 sm:mx-1" />
              <button onClick={() => { localStorage.clear(); window.location.reload(); }} title="Sign Out" className="text-zinc-400 hover:text-red-500 transition active:scale-90 shrink-0"><LogOut size={18} sm:size={22} /></button>
            </>
          ) : (
            <button onClick={() => setShowLogin(true)} className="text-orange-600 font-black flex items-center gap-1.5 text-[9px] sm:text-[10px] uppercase tracking-widest hover:text-orange-500 transition group p-1.5 sm:p-2 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-950/20">
              <Lock size={12} sm:size={14} className="group-hover:-translate-y-0.5 transition-transform" /> <span className="hidden xs:inline">Login</span>
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 overflow-hidden relative">
        {view === 'dashboard' ? (
          <div className="h-full overflow-y-auto pt-8 sm:pt-16 pb-32">
            <div className="container mx-auto max-w-5xl">
              <Dashboard data={data} onSelect={(id) => { setTId(id); setView('tournament'); }} onEdit={openEdit} isAdmin={isAdmin} />
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col overflow-hidden">
            {isLoading && !tData ? (
              <div className="flex items-center justify-center h-full flex-col gap-6">
                <div className="relative">
                  <Volleyball className="text-orange-100 dark:text-zinc-900" size={80} />
                  <Loader2 className="animate-spin text-orange-600 absolute inset-0 m-auto" size={48} />
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

      {/* Floating Action Buttons - Z-INDEX [40] (Below Nav and Modals) */}
      <div className="fixed bottom-6 sm:bottom-8 right-6 sm:right-8 flex flex-col gap-3 sm:gap-4 z-40">
        {view === 'tournament' && (
          <button onClick={() => setTab(tab === 'bracket' ? 'schedule' : 'bracket')} className="p-4 sm:p-5 bg-orange-600 text-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl transition hover:scale-110 active:scale-95 shadow-orange-900/40 border-2 border-orange-400/20 group relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            {tab === 'bracket' ? <CalendarDays size={24} strokeWidth={3} className="sm:size-7" /> : <Network size={24} strokeWidth={3} className="sm:size-7" />}
          </button>
        )}
        <button onClick={() => setDarkMode(!darkMode)} title="Toggle Theme" className="p-4 sm:p-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl transition hover:scale-110 active:scale-95 border-2 border-zinc-700 dark:border-zinc-300 group">
          {darkMode ? <Sun size={24} strokeWidth={2.5} className="sm:size-7" /> : <Moon size={24} strokeWidth={2.5} className="sm:size-7" />}
        </button>
      </div>

      {/* Modals - Z-INDEX [200] */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title={editTarget ? 'Modify Event' : 'Initialize Event'}>
        <SettingsForm
          tournament={editTarget}
          onSubmit={() => { setShowSettings(false); loadDashboard(); }}
          onDelete={async (id) => { if (window.confirm("Purge this tournament and all its history?")) { await api.delete(`/tournaments/${id}`); setShowSettings(false); setView('dashboard'); loadDashboard(); } }}
        />
      </Modal>

      <Modal isOpen={!!scoreMatch} onClose={() => setScoreMatch(null)} title={`Match Protocol #${scoreMatch?.number}`}>
        {scoreMatch && <ScoreForm
          match={scoreMatch}
          isAdmin={isAdmin}
          onClear={async (id, c) => { await api.post(`/tournaments/${tId}/report`, { id, code: c, clear: true }); setScoreMatch(null); }}
          onSubmit={async (id, s, c) => { await api.post(`/tournaments/${tId}/report`, { id, sets: s, code: c }); setScoreMatch(null); }}
        />}
      </Modal>

      <Modal isOpen={showLogin} onClose={() => setShowLogin(false)} title="System Access">
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Identity</label>
            <input name="username" placeholder="Admin UID" required className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-4 rounded-2xl dark:text-white outline-none focus:border-orange-500 transition font-bold" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Secret Key</label>
            <input name="password" type="password" placeholder="••••••••" required className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-4 rounded-2xl dark:text-white outline-none focus:border-orange-500 transition font-bold" />
          </div>
          <button className="w-full bg-orange-600 hover:bg-orange-500 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-orange-600/30 transition active:scale-95 mt-4">Authenticate</button>
        </form>
      </Modal>
    </div>
  );
}