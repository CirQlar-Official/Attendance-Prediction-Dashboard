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
import { Input, SmoothInput } from '../components/ui/input';
import { DataLoadingState, DataErrorState } from '../components/DataState';

// ─── Component ────────────────────────────────────────────────────────────────

interface HistoryProps {
  isAdmin: boolean;
}

// Each entry combines its light classes (base) with its dark classes
// (dark: variant) into one string, so callers apply both at once and the
// browser's `.dark` class toggle picks the right one - no JS branching.
const PERSON_COLOR_PALETTE = [
  'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/70 dark:text-purple-300 dark:border-purple-800',
  'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/70 dark:text-blue-300 dark:border-blue-800',
  'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/70 dark:text-emerald-300 dark:border-emerald-800',
  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/70 dark:text-amber-300 dark:border-amber-800',
  'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/70 dark:text-rose-300 dark:border-rose-800',
  'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/70 dark:text-cyan-300 dark:border-cyan-800',
  'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/70 dark:text-fuchsia-300 dark:border-fuchsia-800',
  'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/70 dark:text-orange-300 dark:border-orange-800',
];

const getPersonColorClasses = (person: string) => {
  const normalized = person.trim().toLowerCase();
  let hash = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }

  return PERSON_COLOR_PALETTE[hash % PERSON_COLOR_PALETTE.length];
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
  const { sorted, loading, error, deleteEntry, updateEntry } = useAttendanceData(selectedGroup?.id ?? null);
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
    <div className="flex-1 min-h-0 w-full overflow-auto bg-white dark:bg-gray-900">
      <div className="flex flex-col gap-[16px] items-start p-[10px] w-full pb-[80px]">

        {/* Header */}
        <div className="flex flex-col items-center justify-center pt-[50px] w-full text-center gap-4">
          <div className="flex items-center justify-between w-full px-4">
            <div className="w-8" />
            <div>
              <p className="font-['Segoe_UI'] font-semibold text-[24px] text-black dark:text-white">
                History
              </p>
              <p className="font-['Segoe_UI'] text-[14px] text-[#4c4c4c] dark:text-gray-300">
                {sorted.length} total records
              </p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="px-3 py-2 rounded-lg transition bg-gray-200 text-gray-700 dark:bg-yellow-500 dark:text-gray-900"
            >
              {darkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </div>
        </div>

        {loading ? (
          <DataLoadingState label="Loading history" />
        ) : error ? (
          <DataErrorState message={error} />
        ) : (
        <>

        {chartData.length > 0 && (
          <div className="w-full rounded-[15px] border border-[#eceef2] bg-white p-[14px] dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-['Segoe_UI'] text-[13px] font-semibold text-black dark:text-white">
                  Attendance trend
                </p>
                <p className="font-['Segoe_UI'] text-[12px] text-[#4c4c4c] dark:text-gray-400">
                  Full history · scroll horizontally to explore
                </p>
              </div>
            </div>
            <div className="overflow-x-auto pb-2">
              {/* Hand-rolled SVG chart - stroke/fill are SVG attributes, not
                  classNames, so darkMode stays JS-level logic here. */}
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
          <div className="flex-1 flex items-center gap-[8px] rounded-[10px] px-[12px] py-[10px] border border-[#eceef2] bg-[#f3f4f6] dark:border-gray-700 dark:bg-gray-800">
            <Search className="size-4 shrink-0 text-[#9ca3af] dark:text-gray-400" />
            <SmoothInput
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by date, count, or event…"
              className="flex-1 bg-transparent font-['Segoe_UI'] text-[14px] text-black placeholder-[#9ca3af] dark:text-white dark:placeholder-gray-500"
              wrapperClassName="flex-1 border-0 bg-transparent p-0"
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X className="size-4 text-[#9ca3af] dark:text-gray-400" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`relative flex items-center gap-[6px] px-[14px] rounded-[10px] border transition ${
              showFilters
                ? 'bg-[#000124] border-[#000124] text-white dark:bg-blue-600 dark:border-blue-600'
                : 'bg-[#f3f4f6] border-[#eceef2] text-[#4c4c4c] dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
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
            className="flex items-center gap-[4px] px-[14px] rounded-[10px] border border-[#eceef2] bg-[#f3f4f6] text-[#4c4c4c] transition dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {sortDir === 'desc'
              ? <ChevronDown className="size-4" />
              : <ChevronUp className="size-4" />
            }
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="w-full rounded-[12px] border border-[#eceef2] bg-white p-[16px] flex flex-col gap-[12px] dark:border-gray-700 dark:bg-gray-800">
            {/* Church Event filter */}
            <div>
              <label className="font-['Segoe_UI'] text-[12px] block mb-[6px] text-[#4c4c4c] dark:text-gray-400">
                Church Event
              </label>
              <select
                value={filterEvent}
                onChange={e => setFilterEvent(e.target.value as ChurchEvent | 'All')}
                className="w-full rounded-[8px] px-[10px] py-[8px] font-['Segoe_UI'] text-[13px] outline-none bg-[#f3f4f6] text-black dark:bg-gray-700 dark:text-white"
              >
                <option value="All">All Events</option>
                {CHURCH_EVENTS.map(ev => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </select>
            </div>

            {/* Fast Sunday filter */}
            <div>
              <label className="font-['Segoe_UI'] text-[12px] block mb-[6px] text-[#4c4c4c] dark:text-gray-400">
                Fast Sunday
              </label>
              <div className="flex gap-[8px]">
                {(['All', 'Yes', 'No'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setFilterFast(opt)}
                    className={`flex-1 py-[8px] rounded-[8px] font-['Segoe_UI'] text-[13px] transition ${
                      filterFast === opt
                        ? 'bg-[#000124] text-white dark:bg-blue-600'
                        : 'bg-[#f3f4f6] text-[#4c4c4c] dark:bg-gray-700 dark:text-gray-300'
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
        <p className="font-['Segoe_UI'] text-[12px] px-1 text-[#9ca3af] dark:text-gray-400">
          Showing {filtered.length} of {sorted.length} records
        </p>

        {/* Records list */}
        <div className="w-full rounded-[15px] border-2 overflow-hidden border-[#eceef2] bg-white dark:border-gray-700 dark:bg-gray-800">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-[60px] gap-3">
              <Calendar className="size-10 text-[#e5e7eb] dark:text-gray-600" />
              <p className="font-['Segoe_UI'] text-[14px] text-[#9ca3af] dark:text-gray-400">
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
                  className={index !== filtered.length - 1 ? 'border-b border-[#eceef2] dark:border-gray-700' : ''}
                >
                  {isEditing ? (
                    /* ── Edit mode ── */
                    <div className="p-[16px] flex flex-col gap-[10px]">
                      <p className="font-['Segoe_UI'] text-[13px] text-[#4c4c4c] dark:text-gray-300">
                        Editing {format(new Date(entry.date + 'T12:00:00'), 'MMMM d, yyyy')}
                      </p>

                      {/* Attendance input */}
                      <Input
                        type="number"
                        value={editAttendance}
                        onChange={e => setEditAttendance(e.target.value)}
                        className="font-['Segoe_UI'] text-[14px] text-black dark:text-white"
                        wrapperClassName="w-full p-0"
                      />

                      {/* Event select */}
                      <select
                        value={editEvent}
                        onChange={e => setEditEvent(e.target.value as ChurchEvent)}
                        className="w-full rounded-[8px] px-[10px] py-[8px] font-['Segoe_UI'] text-[13px] outline-none bg-[#f3f4f6] text-black dark:bg-gray-700 dark:text-white"
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
                            ? 'bg-[#000124] text-white dark:bg-blue-600'
                            : 'bg-[#f3f4f6] text-[#4c4c4c] dark:bg-gray-700 dark:text-gray-300'
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
                          className="flex-1 flex items-center justify-center gap-1 py-[8px] rounded-[8px] font-['Segoe_UI'] text-[13px] bg-[#f3f4f6] text-[#4c4c4c] dark:bg-gray-700 dark:text-gray-300"
                        >
                          <X className="size-4" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : isConfirmingDelete ? (
                    /* ── Delete confirm ── */
                    <div className="p-[16px] flex items-center justify-between gap-[10px] bg-red-50 dark:bg-red-950">
                      <p className="font-['Segoe_UI'] text-[13px] flex-1 text-red-600 dark:text-red-300">
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
                        className="px-[14px] py-[7px] rounded-[8px] font-['Segoe_UI'] text-[13px] bg-white text-[#4c4c4c] border border-[#eceef2] dark:bg-gray-700 dark:text-gray-300 dark:border-transparent"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    /* ── Normal row ── */
                    <div className="flex items-center px-[16px] py-[14px] gap-[10px]">
                      <div className="flex-1 min-w-0">
                        <p className="font-['Segoe_UI'] text-[14px] text-black dark:text-white">
                          {format(new Date(entry.date + 'T12:00:00'), 'MMMM d, yyyy')}
                        </p>
                        <div className="flex items-center gap-[6px] mt-[2px] flex-wrap">
                          {entry.createdBy && (
                            <span className={`font-['Segoe_UI'] text-[10px] px-[6px] py-[2px] rounded-[4px] border ${getPersonColorClasses(entry.createdBy)}`}>
                              Added by {entry.createdBy.split('@')[0]}
                            </span>
                          )}
                          {entry.churchEvent !== 'None' && (
                            <span className="font-['Segoe_UI'] text-[11px] px-[6px] py-[2px] rounded-[4px] bg-[#eceef2] text-[#4c4c4c] dark:bg-gray-700 dark:text-gray-300">
                              {entry.churchEvent}
                            </span>
                          )}
                          {entry.isFastSunday === 1 && (
                            <span className="font-['Segoe_UI'] text-[11px] px-[6px] py-[2px] rounded-[4px] bg-[#000124] text-white dark:bg-blue-900 dark:text-blue-300">
                              Fast
                            </span>
                          )}
                          {entry.isSummer === 1 && (
                            <span className="font-['Segoe_UI'] text-[11px] px-[6px] py-[2px] rounded-[4px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                              Summer
                            </span>
                          )}
                          {entry.averagedFrom && entry.averagedFrom.length > 0 && (
                            <span className="font-['Segoe_UI'] text-[10px] px-[6px] py-[2px] rounded-[4px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              Averaged
                            </span>
                          )}
                        </div>

                        {/* ── Averaged breakdown ── */}
                        {entry.averagedFrom && entry.averagedFrom.length > 0 && (
                          <div className="mt-[8px] text-[11px] text-gray-600 dark:text-gray-400">
                            <p className="font-semibold mb-[2px]">Averaged from:</p>
                            {entry.averagedFrom.map((contrib, idx) => (
                              <p key={idx} className="ml-[4px]">
                                <span className={`mr-[6px] rounded-[4px] border px-[6px] py-[2px] ${getPersonColorClasses(contrib.email)}`}>
                                  {contrib.email.split('@')[0]}
                                </span>
                                {contrib.attendance}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="font-['Segoe_UI'] text-[20px] font-light shrink-0 text-black dark:text-white">
                        {entry.attendance}
                      </p>

                      {/* Actions — admins only */}
                      {isAdmin && (
                        <div className="flex items-center gap-[6px] shrink-0">
                          <button
                            onClick={() => startEdit(entry)}
                            className="p-[7px] rounded-[8px] transition bg-[#f3f4f6] text-[#4c4c4c] hover:bg-[#eceef2] dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(entry.id)}
                            className="p-[7px] rounded-[8px] transition bg-[#f3f4f6] text-[#ef4444] hover:bg-red-50 dark:bg-gray-700 dark:text-red-400 dark:hover:bg-red-950"
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
        </>
        )}
      </div>
    </div>
  );
}