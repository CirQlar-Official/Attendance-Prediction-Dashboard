import { useState, useMemo } from 'react';
import { useAttendanceData, type Group } from '../hooks/useAttendanceData';
import { useDarkMode } from '../context/DarkModeContext';
import { useOutletContext } from 'react-router';
import {
  CHURCH_EVENTS,
  autoIsSummer,
  autoIsHoliday,
  type ChurchEvent,
} from '../hooks/useAttendanceData';
import { format } from 'date-fns';
import {
  Search,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Calendar,
  Filter,
} from 'lucide-react';

interface HistoryProps {
  isAdmin: boolean;
}

const PERSON_COLOR_PALETTE = [
  { light: 'bg-purple-100 text-purple-700 border-purple-200', dark: 'bg-purple-900/70 text-purple-300 border-purple-800' },
  { light: 'bg-blue-100 text-blue-700 border-blue-200', dark: 'bg-blue-900/70 text-blue-300 border-blue-800' },
  { light: 'bg-emerald-100 text-emerald-700 border-emerald-200', dark: 'bg-emerald-900/70 text-emerald-300 border-emerald-800' },
  { light: 'bg-amber-100 text-amber-700 border-amber-200', dark: 'bg-amber-900/70 text-amber-300 border-amber-800' },
  { light: 'bg-rose-100 text-rose-700 border-rose-200', dark: 'bg-rose-900/70 text-rose-300 border-rose-800' },
  { light: 'bg-cyan-100 text-cyan-700 border-cyan-200', dark: 'bg-cyan-900/70 text-cyan-300 border-cyan-800' },
  { light: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200', dark: 'bg-fuchsia-900/70 text-fuchsia-300 border-fuchsia-800' },
  { light: 'bg-orange-100 text-orange-700 border-orange-200', dark: 'bg-orange-900/70 text-orange-300 border-orange-800' },
];

const getPersonColorClasses = (person: string, darkMode: boolean) => {
  const normalized = person.trim().toLowerCase();
  let hash = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }

  const paletteEntry = PERSON_COLOR_PALETTE[hash % PERSON_COLOR_PALETTE.length];
  return darkMode ? paletteEntry.dark : paletteEntry.light;
};

const getChartPoint = (
  point: { date: string; attendance: number },
  index: number,
  chartWidth: number,
  chartHeight: number,
  leftPadding: number,
  rightPadding: number,
  topPadding: number,
  bottomPadding: number,
  chartStep: number,
  minAttendance: number,
  chartRange: number
) => {
  const x = leftPadding + index * chartStep;
  const normalized = (point.attendance - minAttendance) / chartRange;
  const y = chartHeight - bottomPadding - normalized * (chartHeight - topPadding - bottomPadding);
  return { x, y };
};

export function History({ isAdmin }: HistoryProps) {
  const { selectedGroup } = useOutletContext<{ selectedGroup: Group | null }>();
  const { sorted, deleteEntry, updateEntry } = useAttendanceData(selectedGroup?.id ?? null);
  const { darkMode, setDarkMode } = useDarkMode();

  const [search, setSearch] = useState('');
  const [filterEvent, setFilterEvent] = useState<ChurchEvent | 'All'>('All');
  const [filterFast, setFilterFast] = useState<'All' | 'Yes' | 'No'>('All');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Edit state
  const [editAttendance, setEditAttendance] = useState('');
  const [editEvent, setEditEvent] = useState<ChurchEvent>('None');
  const [editFast, setEditFast] = useState<0 | 1>(0);

  const filtered = useMemo(() => {
    let list = [...sorted];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.date.includes(q) ||
        e.attendance.toString().includes(q) ||
        e.churchEvent?.toLowerCase().includes(q)
      );
    }

    if (filterEvent !== 'All') {
      list = list.filter(e => e.churchEvent === filterEvent);
    }

    if (filterFast !== 'All') {
      list = list.filter(e => e.isFastSunday === (filterFast === 'Yes' ? 1 : 0));
    }

    return sortDir === 'desc' ? list.reverse() : list;
  }, [sorted, search, filterEvent, filterFast, sortDir]);

  const startEdit = (entry: typeof sorted[0]) => {
    setEditingId(entry.id);
    setEditAttendance(entry.attendance.toString());
    setEditEvent(entry.churchEvent ?? 'None');
    setEditFast(entry.isFastSunday ?? 0);
    setDeleteConfirmId(null);
  };

  const saveEdit = (id: string, date: string) => {
    const att = parseInt(editAttendance);
    if (isNaN(att) || att < 0) return;
    const d = new Date(date + 'T12:00:00');
    const month = d.getMonth() + 1;

    updateEntry(id, {
      attendance: att,
      churchEvent: editEvent,
      isFastSunday: editFast,
      isSummer: autoIsSummer(month),
      isHolidaySeason: autoIsHoliday(month),
    });
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const confirmDelete = (id: string) => {
    deleteEntry(id);
    setDeleteConfirmId(null);
  };

  const activeFilterCount = [
    filterEvent !== 'All',
    filterFast !== 'All',
  ].filter(Boolean).length;

  const chartData = useMemo(
    () => sorted.map(entry => ({ date: entry.date, attendance: entry.attendance })),
    [sorted]
  );

  const chartWidth = Math.max(720, chartData.length * 48 + 72);
  const chartHeight = 220;
  const leftPadding = 28;
  const rightPadding = 24;
  const topPadding = 20;
  const bottomPadding = 28;
  const chartStep = chartData.length > 1 ? (chartWidth - leftPadding - rightPadding) / (chartData.length - 1) : 0;
  const maxAttendance = Math.max(...chartData.map(point => point.attendance), 1);
  const minAttendance = Math.min(...chartData.map(point => point.attendance), 0);
  const chartRange = Math.max(maxAttendance - minAttendance, 1);
  const points = chartData.map((point, index) => {
    const { x, y } = getChartPoint(
      point,
      index,
      chartWidth,
      chartHeight,
      leftPadding,
      rightPadding,
      topPadding,
      bottomPadding,
      chartStep,
      minAttendance,
      chartRange
    );
    return `${x},${y}`;
  });

  return (
    <div className={`flex-1 min-h-0 w-full overflow-auto ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <div className="flex flex-col gap-[16px] items-start p-[10px] w-full pb-[80px]">

        {/* Header */}
        <div className="flex flex-col items-center justify-center pt-[50px] w-full text-center gap-4">
          <div className="flex items-center justify-between w-full px-4">
            <div className="w-8" />
            <div>
              <p className={`font-['Segoe_UI'] font-semibold text-[24px] ${darkMode ? 'text-white' : 'text-black'}`}>
                History
              </p>
              <p className={`font-['Segoe_UI'] text-[14px] ${darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'}`}>
                {sorted.length} total records
              </p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`px-3 py-2 rounded-lg transition ${
                darkMode ? 'bg-yellow-500 text-gray-900' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {darkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className={`w-full rounded-[15px] border p-[14px] ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-[#eceef2] bg-white'}`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className={`font-['Segoe_UI'] text-[13px] font-semibold ${darkMode ? 'text-white' : 'text-black'}`}>
                  Attendance trend
                </p>
                <p className={`font-['Segoe_UI'] text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'}`}>
                  Full history · scroll horizontally to explore
                </p>
              </div>
            </div>
            <div className="overflow-x-auto pb-2">
              <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[640px]">
                {[0, 0.25, 0.5, 0.75, 1].map(step => {
                  const y = topPadding + (chartHeight - topPadding - bottomPadding) * (1 - step);
                  return (
                    <line
                      key={step}
                      x1={leftPadding}
                      x2={chartWidth - rightPadding}
                      y1={y}
                      y2={y}
                      stroke={darkMode ? '#374151' : '#e5e7eb'}
                      strokeDasharray="4 4"
                    />
                  );
                })}
                <polyline
                  fill="none"
                  stroke={darkMode ? '#60a5fa' : '#029eff'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points.join(' ')}
                />
                {chartData.map((point, index) => {
                  const { x, y } = getChartPoint(
                    point,
                    index,
                    chartWidth,
                    chartHeight,
                    leftPadding,
                    rightPadding,
                    topPadding,
                    bottomPadding,
                    chartStep,
                    minAttendance,
                    chartRange
                  );
                  return (
                    <g key={point.date}>
                      <circle cx={x} cy={y} r="3.5" fill={darkMode ? '#60a5fa' : '#029eff'} />
                      {index % 3 === 0 && (
                        <text
                          x={x}
                          y={chartHeight - 8}
                          textAnchor="middle"
                          fontSize="10"
                          fill={darkMode ? '#9ca3af' : '#6b7280'}
                        >
                          {format(new Date(point.date + 'T12:00:00'), 'MMM d')}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Search + Filter row */}
        <div className="w-full flex gap-[8px]">
          <div className={`flex-1 flex items-center gap-[8px] rounded-[10px] px-[12px] py-[10px] ${
            darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-[#f3f4f6] border border-[#eceef2]'
          }`}>
            <Search className={`size-4 shrink-0 ${darkMode ? 'text-gray-400' : 'text-[#9ca3af]'}`} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by date, count, or event…"
              className={`flex-1 bg-transparent outline-none font-['Segoe_UI'] text-[14px] ${
                darkMode ? 'text-white placeholder-gray-500' : 'text-black placeholder-[#9ca3af]'
              }`}
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X className={`size-4 ${darkMode ? 'text-gray-400' : 'text-[#9ca3af]'}`} />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`relative flex items-center gap-[6px] px-[14px] rounded-[10px] border transition ${
              showFilters
                ? darkMode ? 'bg-blue-600 border-blue-600 text-white' : 'bg-[#000124] border-[#000124] text-white'
                : darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-[#f3f4f6] border-[#eceef2] text-[#4c4c4c]'
            }`}
          >
            <Filter className="size-4" />
            <span className="font-['Segoe_UI'] text-[13px]">Filter</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#029eff] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort toggle */}
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className={`flex items-center gap-[4px] px-[14px] rounded-[10px] border transition ${
              darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-[#f3f4f6] border-[#eceef2] text-[#4c4c4c]'
            }`}
          >
            {sortDir === 'desc'
              ? <ChevronDown className="size-4" />
              : <ChevronUp className="size-4" />
            }
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className={`w-full rounded-[12px] border p-[16px] flex flex-col gap-[12px] ${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-[#eceef2]'
          }`}>
            {/* Church Event filter */}
            <div>
              <label className={`font-['Segoe_UI'] text-[12px] block mb-[6px] ${
                darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'
              }`}>
                Church Event
              </label>
              <select
                value={filterEvent}
                onChange={e => setFilterEvent(e.target.value as ChurchEvent | 'All')}
                className={`w-full rounded-[8px] px-[10px] py-[8px] font-['Segoe_UI'] text-[13px] outline-none ${
                  darkMode ? 'bg-gray-700 text-white' : 'bg-[#f3f4f6] text-black'
                }`}
              >
                <option value="All">All Events</option>
                {CHURCH_EVENTS.map(ev => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </select>
            </div>

            {/* Fast Sunday filter */}
            <div>
              <label className={`font-['Segoe_UI'] text-[12px] block mb-[6px] ${
                darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'
              }`}>
                Fast Sunday
              </label>
              <div className="flex gap-[8px]">
                {(['All', 'Yes', 'No'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setFilterFast(opt)}
                    className={`flex-1 py-[8px] rounded-[8px] font-['Segoe_UI'] text-[13px] transition ${
                      filterFast === opt
                        ? darkMode ? 'bg-blue-600 text-white' : 'bg-[#000124] text-white'
                        : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-[#f3f4f6] text-[#4c4c4c]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setFilterEvent('All'); setFilterFast('All'); }}
                className="font-['Segoe_UI'] text-[12px] text-[#029eff] text-left"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Results count */}
        <p className={`font-['Segoe_UI'] text-[12px] px-1 ${darkMode ? 'text-gray-400' : 'text-[#9ca3af]'}`}>
          Showing {filtered.length} of {sorted.length} records
        </p>

        {/* Records list */}
        <div className={`w-full rounded-[15px] border-2 overflow-hidden ${
          darkMode ? 'border-gray-700 bg-gray-800' : 'border-[#eceef2] bg-white'
        }`}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-[60px] gap-3">
              <Calendar className={`size-10 ${darkMode ? 'text-gray-600' : 'text-[#e5e7eb]'}`} />
              <p className={`font-['Segoe_UI'] text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#9ca3af]'}`}>
                No records found
              </p>
            </div>
          ) : (
            filtered.map((entry, index) => {
              const isEditing = editingId === entry.id;
              const isConfirmingDelete = deleteConfirmId === entry.id;

              return (
                <div
                  key={entry.id}
                  className={`${
                    index !== filtered.length - 1
                      ? darkMode ? 'border-b border-gray-700' : 'border-b border-[#eceef2]'
                      : ''
                  }`}
                >
                  {isEditing ? (
                    /* ── Edit mode ── */
                    <div className="p-[16px] flex flex-col gap-[10px]">
                      <p className={`font-['Segoe_UI'] text-[13px] ${darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'}`}>
                        Editing {format(new Date(entry.date + 'T12:00:00'), 'MMMM d, yyyy')}
                      </p>

                      {/* Attendance input */}
                      <input
                        type="number"
                        value={editAttendance}
                        onChange={e => setEditAttendance(e.target.value)}
                        className={`w-full rounded-[8px] px-[10px] py-[8px] font-['Segoe_UI'] text-[14px] outline-none focus:ring-2 focus:ring-[#029eff] ${
                          darkMode ? 'bg-gray-700 text-white' : 'bg-[#f3f4f6] text-black'
                        }`}
                      />

                      {/* Event select */}
                      <select
                        value={editEvent}
                        onChange={e => setEditEvent(e.target.value as ChurchEvent)}
                        className={`w-full rounded-[8px] px-[10px] py-[8px] font-['Segoe_UI'] text-[13px] outline-none ${
                          darkMode ? 'bg-gray-700 text-white' : 'bg-[#f3f4f6] text-black'
                        }`}
                      >
                        {CHURCH_EVENTS.map(ev => (
                          <option key={ev} value={ev}>{ev}</option>
                        ))}
                      </select>

                      {/* Fast Sunday toggle */}
                      <button
                        onClick={() => setEditFast(editFast === 1 ? 0 : 1)}
                        className={`w-full py-[8px] rounded-[8px] font-['Segoe_UI'] text-[13px] transition ${
                          editFast === 1
                            ? darkMode ? 'bg-blue-600 text-white' : 'bg-[#000124] text-white'
                            : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-[#f3f4f6] text-[#4c4c4c]'
                        }`}
                      >
                        Fast Sunday: {editFast === 1 ? 'Yes' : 'No'}
                      </button>

                      {/* Save / Cancel */}
                      <div className="flex gap-[8px]">
                        <button
                          onClick={() => saveEdit(entry.id, entry.date)}
                          className="flex-1 flex items-center justify-center gap-1 py-[8px] rounded-[8px] bg-[#14ae5c] text-white font-['Segoe_UI'] text-[13px]"
                        >
                          <Check className="size-4" /> Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className={`flex-1 flex items-center justify-center gap-1 py-[8px] rounded-[8px] font-['Segoe_UI'] text-[13px] ${
                            darkMode ? 'bg-gray-700 text-gray-300' : 'bg-[#f3f4f6] text-[#4c4c4c]'
                          }`}
                        >
                          <X className="size-4" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : isConfirmingDelete ? (
                    /* ── Delete confirm ── */
                    <div className={`p-[16px] flex items-center justify-between gap-[10px] ${
                      darkMode ? 'bg-red-950' : 'bg-red-50'
                    }`}>
                      <p className={`font-['Segoe_UI'] text-[13px] flex-1 ${
                        darkMode ? 'text-red-300' : 'text-red-600'
                      }`}>
                        Delete {format(new Date(entry.date + 'T12:00:00'), 'MMM d, yyyy')}?
                      </p>
                      <button
                        onClick={() => confirmDelete(entry.id)}
                        className="px-[14px] py-[7px] bg-[#ef4444] text-white rounded-[8px] font-['Segoe_UI'] text-[13px]"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className={`px-[14px] py-[7px] rounded-[8px] font-['Segoe_UI'] text-[13px] ${
                          darkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-[#4c4c4c] border border-[#eceef2]'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    /* ── Normal row ── */
                    <div className="flex items-center px-[16px] py-[14px] gap-[10px]">
                      <div className="flex-1 min-w-0">
                        <p className={`font-['Segoe_UI'] text-[14px] ${darkMode ? 'text-white' : 'text-black'}`}>
                          {format(new Date(entry.date + 'T12:00:00'), 'MMMM d, yyyy')}
                        </p>
                        <div className="flex items-center gap-[6px] mt-[2px] flex-wrap">
                          {entry.createdBy && (
                            <span className={`font-['Segoe_UI'] text-[10px] px-[6px] py-[2px] rounded-[4px] border ${getPersonColorClasses(entry.createdBy, darkMode)}`}>
                              Added by {entry.createdBy.split('@')[0]}
                            </span>
                          )}
                          {entry.churchEvent !== 'None' && (
                            <span className={`font-['Segoe_UI'] text-[11px] px-[6px] py-[2px] rounded-[4px] ${
                              darkMode ? 'bg-gray-700 text-gray-300' : 'bg-[#eceef2] text-[#4c4c4c]'
                            }`}>
                              {entry.churchEvent}
                            </span>
                          )}
                          {entry.isFastSunday === 1 && (
                            <span className={`font-['Segoe_UI'] text-[11px] px-[6px] py-[2px] rounded-[4px] ${
                              darkMode ? 'bg-blue-900 text-blue-300' : 'bg-[#000124] text-white'
                            }`}>
                              Fast
                            </span>
                          )}
                          {entry.isSummer === 1 && (
                            <span className={`font-['Segoe_UI'] text-[11px] px-[6px] py-[2px] rounded-[4px] ${
                              darkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              Summer
                            </span>
                          )}
                          {entry.averagedFrom && entry.averagedFrom.length > 0 && (
                            <span className={`font-['Segoe_UI'] text-[10px] px-[6px] py-[2px] rounded-[4px] ${
                              darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'
                            }`}>
                              Averaged
                            </span>
                          )}
                        </div>
                        
                        {/* Show averaged data breakdown if applicable */}
                        {entry.averagedFrom && entry.averagedFrom.length > 0 && (
                          <div className={`mt-[8px] text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            <p className="font-semibold mb-[2px]">Averaged from:</p>
                            {entry.averagedFrom.map((contrib, idx) => (
                              <p key={idx} className="ml-[4px]">
                                <span className={`mr-[6px] rounded-[4px] border px-[6px] py-[2px] ${getPersonColorClasses(contrib.email, darkMode)}`}>
                                  {contrib.email.split('@')[0]}
                                </span>
                                {contrib.attendance}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className={`font-['Segoe_UI'] text-[20px] font-light shrink-0 ${
                        darkMode ? 'text-white' : 'text-black'
                      }`}>
                        {entry.attendance}
                      </p>

                      {/* Actions — admins only */}
                      {isAdmin && (
                        <div className="flex items-center gap-[6px] shrink-0">
                          <button
                            onClick={() => startEdit(entry)}
                            className={`p-[7px] rounded-[8px] transition ${
                              darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-[#f3f4f6] text-[#4c4c4c] hover:bg-[#eceef2]'
                            }`}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(entry.id)}
                            className={`p-[7px] rounded-[8px] transition ${
                              darkMode ? 'bg-gray-700 text-red-400 hover:bg-red-950' : 'bg-[#f3f4f6] text-[#ef4444] hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}