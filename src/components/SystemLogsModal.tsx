import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Filter,
  Calendar,
  Download,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Activity,
  PlusCircle,
  Edit3,
  AlertCircle,
  FileText,
} from 'lucide-react';
import {
  SystemLog,
  LogCategory,
  LogActionStatus,
  logCategoryMeta,
  AppSettings,
} from '../types';
import {
  getSystemLogs,
  clearSystemLogs,
  formatLogDateTime,
} from '../utils/systemLogs';
import { PaginationControls } from './PaginationControls';
import { sound } from '../utils/sound';

interface SystemLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
}

export const SystemLogsModal: React.FC<SystemLogsModalProps> = ({
  isOpen,
  onClose,
  settings,
}) => {
  const isUrdu = settings.language === 'ur';

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTitleFilter, setSelectedTitleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [dateFilterPreset, setDateFilterPreset] = useState<
    'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'
  >('all');
  const [customFromDate, setCustomFromDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [customToDate, setCustomToDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Clear confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load logs on open and listen to live additions
  const reloadLogs = () => {
    setLogs(getSystemLogs());
  };

  useEffect(() => {
    if (isOpen) {
      reloadLogs();
      setCurrentPage(1);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleLogAdded = () => {
      reloadLogs();
    };
    const handleLogsCleared = () => {
      setLogs([]);
    };

    window.addEventListener('mandi_system_log_added', handleLogAdded);
    window.addEventListener('mandi_system_logs_cleared', handleLogsCleared);

    return () => {
      window.removeEventListener('mandi_system_log_added', handleLogAdded);
      window.removeEventListener('mandi_system_logs_cleared', handleLogsCleared);
    };
  }, []);

  // Filter logic
  const filteredLogs = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = yesterdayObj.toISOString().slice(0, 10);

    const weekAgoObj = new Date();
    weekAgoObj.setDate(weekAgoObj.getDate() - 7);
    const weekAgoStr = weekAgoObj.toISOString().slice(0, 10);

    const monthStr = todayStr.slice(0, 7);

    return logs.filter((log) => {
      // 1. Title / Short Category filter
      if (selectedTitleFilter !== 'all' && log.title !== selectedTitleFilter) {
        return false;
      }

      // 2. Status filter
      if (selectedStatusFilter !== 'all' && log.status !== selectedStatusFilter) {
        return false;
      }

      // 3. Date filter
      const logDateStr = log.timestamp.slice(0, 10);
      if (dateFilterPreset === 'today') {
        if (logDateStr !== todayStr) return false;
      } else if (dateFilterPreset === 'yesterday') {
        if (logDateStr !== yesterdayStr) return false;
      } else if (dateFilterPreset === 'week') {
        if (logDateStr < weekAgoStr || logDateStr > todayStr) return false;
      } else if (dateFilterPreset === 'month') {
        if (!logDateStr.startsWith(monthStr)) return false;
      } else if (dateFilterPreset === 'custom') {
        if (logDateStr < customFromDate || logDateStr > customToDate) return false;
      }

      // 4. Search query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesDesc = log.description?.toLowerCase().includes(query) ?? false;
        const matchesEn = log.descriptionEn?.toLowerCase().includes(query) ?? false;
        const matchesTitle = log.title?.toLowerCase().includes(query) ?? false;
        const matchesStatus = log.status?.toLowerCase().includes(query) ?? false;
        const matchesEntity = log.entityId?.toLowerCase().includes(query) ?? false;
        const matchesMeta = log.meta ? JSON.stringify(log.meta).toLowerCase().includes(query) : false;

        if (!matchesDesc && !matchesEn && !matchesTitle && !matchesStatus && !matchesEntity && !matchesMeta) {
          return false;
        }
      }

      return true;
    });
  }, [
    logs,
    selectedTitleFilter,
    selectedStatusFilter,
    dateFilterPreset,
    customFromDate,
    customToDate,
    searchTerm,
  ]);

  // Overall statistics
  const stats = useMemo(() => {
    let created = 0;
    let updated = 0;
    let deleted = 0;

    filteredLogs.forEach((l) => {
      if (l.status === 'created') created++;
      else if (l.status === 'updated') updated++;
      else if (l.status === 'deleted') deleted++;
    });

    return { total: filteredLogs.length, created, updated, deleted };
  }, [filteredLogs]);

  // Paginated logs
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Export to CSV
  const handleExportCSV = () => {
    sound.playTick();
    if (filteredLogs.length === 0) return;

    const headers = ['#', 'Timestamp', 'Date', 'Time', 'Code', 'Status', 'Description'];
    const rows = filteredLogs.map((l, idx) => {
      const dt = formatLogDateTime(l.timestamp, false);
      return [
        idx + 1,
        `"${l.timestamp}"`,
        `"${dt.date}"`,
        `"${dt.time}"`,
        `"${l.title}"`,
        `"${l.status}"`,
        `"${(l.description || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `System_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearAll = () => {
    sound.playPop();
    clearSystemLogs();
    setLogs([]);
    setShowClearConfirm(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        dir="rtl"
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] text-slate-900"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black font-urdu-sans leading-tight">
                  {isUrdu ? 'سسٹم ٹرانزیکشن آڈٹ لاگز' : 'System Audit & Transaction Logs'}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 font-bold border border-indigo-400/40">
                  {logs.length} {isUrdu ? 'کل لاگز' : 'Logs'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-urdu-sans mt-0.5">
                {isUrdu
                  ? 'تمام مالیاتی اندراجات، بولی، اخراجات، ترامیم اور حذف کا تفصیلی کمپیوٹر ریکارڈ'
                  : 'Immutable security log of all lot additions, bids, expenses, updates & deletions'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={reloadLogs}
              title={isUrdu ? 'ریفریش لاگز' : 'Refresh'}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95 border border-slate-700"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              title={isUrdu ? 'ایکسل / CSV ڈاؤنلوڈ' : 'Export CSV'}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold font-urdu-sans flex items-center gap-1.5 transition active:scale-95 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isUrdu ? 'ایکسپورٹ CSV' : 'Export CSV'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition active:scale-95 border border-slate-700 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 border-b border-slate-200">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] text-slate-500 font-bold font-urdu-sans block">
                {isUrdu ? 'دستیاب لاگز:' : 'Filtered Logs:'}
              </span>
              <span className="text-base font-black font-numbers text-slate-900">
                {stats.total.toLocaleString()}
              </span>
            </div>
            <Activity className="w-5 h-5 text-indigo-500" />
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] text-emerald-700 font-bold font-urdu-sans block">
                {isUrdu ? 'نئے اندراجات (Created):' : 'Created Entries:'}
              </span>
              <span className="text-base font-black font-numbers text-emerald-700">
                {stats.created.toLocaleString()}
              </span>
            </div>
            <PlusCircle className="w-5 h-5 text-emerald-600" />
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] text-blue-700 font-bold font-urdu-sans block">
                {isUrdu ? 'ترامیم (Updated):' : 'Updated Entries:'}
              </span>
              <span className="text-base font-black font-numbers text-blue-700">
                {stats.updated.toLocaleString()}
              </span>
            </div>
            <Edit3 className="w-5 h-5 text-blue-600" />
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] text-rose-700 font-bold font-urdu-sans block">
                {isUrdu ? 'حذف شدہ (Deleted):' : 'Deleted Entries:'}
              </span>
              <span className="text-base font-black font-numbers text-rose-700">
                {stats.deleted.toLocaleString()}
              </span>
            </div>
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="p-3 bg-white border-b border-slate-200 space-y-2.5">
          {/* Top Filter Row: Search & Status Selectors */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={isUrdu ? 'تلاش کریں (تفصیل، لاٹ نمبر، خریدار، زمیندار، رقم وغیرہ)...' : 'Search logs by description, lot, amount, or name...'}
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-urdu-sans focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <select
                value={selectedStatusFilter}
                onChange={(e) => {
                  sound.playTick();
                  setSelectedStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-urdu-sans font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">{isUrdu ? 'تمام اسٹیٹس (All)' : 'All Status'}</option>
                <option value="created">{isUrdu ? '✅ اندراج (Created)' : 'Created'}</option>
                <option value="updated">{isUrdu ? '✏️ اپڈیٹ (Updated)' : 'Updated'}</option>
                <option value="deleted">{isUrdu ? '❌ حذف (Deleted)' : 'Deleted'}</option>
              </select>

              {/* Date Presets Select */}
              <select
                value={dateFilterPreset}
                onChange={(e) => {
                  sound.playTick();
                  setDateFilterPreset(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-urdu-sans font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">{isUrdu ? 'تمام تاریخیں' : 'All Time'}</option>
                <option value="today">{isUrdu ? 'آج (Today)' : 'Today'}</option>
                <option value="yesterday">{isUrdu ? 'گزشتہ کل (Yesterday)' : 'Yesterday'}</option>
                <option value="week">{isUrdu ? 'گزشتہ 7 دن (Last 7 Days)' : 'Last 7 Days'}</option>
                <option value="month">{isUrdu ? 'موجودہ ماہ (This Month)' : 'This Month'}</option>
                <option value="custom">{isUrdu ? 'مخصوص تاریخ (Custom Date)' : 'Custom Range'}</option>
              </select>
            </div>
          </div>

          {/* Custom Date Pickers (if custom selected) */}
          {dateFilterPreset === 'custom' && (
            <div className="flex items-center gap-2 p-2 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs animate-in fade-in">
              <Calendar className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-700 font-urdu-sans">{isUrdu ? 'از تاریخ:' : 'From:'}</span>
                  <input
                    type="date"
                    value={customFromDate}
                    onChange={(e) => {
                      setCustomFromDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-numbers"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-700 font-urdu-sans">{isUrdu ? 'تا تاریخ:' : 'To:'}</span>
                  <input
                    type="date"
                    value={customToDate}
                    onChange={(e) => {
                      setCustomToDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-numbers"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Title / Module Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                setSelectedTitleFilter('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-xl font-bold font-urdu-sans whitespace-nowrap transition text-xs ${
                selectedTitleFilter === 'all'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isUrdu ? 'تمام کیٹیگریز' : 'All Modules'}
            </button>

            {(Object.keys(logCategoryMeta) as LogCategory[]).map((catKey) => {
              const meta = logCategoryMeta[catKey];
              const isActive = selectedTitleFilter === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => {
                    sound.playTick();
                    setSelectedTitleFilter(catKey);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-xl font-bold font-urdu-sans whitespace-nowrap transition text-xs flex items-center gap-1 ${
                    isActive
                      ? 'bg-indigo-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-black/10 font-bold">{meta.short}</span>
                  <span>{meta.icon}</span>
                  <span>{isUrdu ? meta.labelUrdu : meta.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Logs Table Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-[300px]">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-urdu-sans">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2 opacity-50" />
              <div className="text-sm font-bold text-slate-600">
                {isUrdu ? 'کوئی لاگ ریکارڈ دستیاب نہیں ملا' : 'No logs found matching current filters'}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isUrdu
                  ? 'لاگ فلٹرز تبدیل کریں یا نیا ڈیٹا شامل کریں۔'
                  : 'Try clearing the search or changing category/status filters.'}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-bold font-urdu-sans border-b border-slate-200">
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3 text-center w-36 sm:w-44">{isUrdu ? 'تاریخ و وقت' : 'Date & Time'}</th>
                    <th className="py-2.5 px-2.5 text-center w-20">{isUrdu ? 'کوڈ / کیٹیگری' : 'Code'}</th>
                    <th className="py-2.5 px-2.5 text-center w-24">{isUrdu ? 'ایکشن اسٹیٹس' : 'Action'}</th>
                    <th className="py-2.5 px-3">{isUrdu ? 'تفصیل ٹرانزیکشن (Log Details)' : 'Description'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-urdu-sans">
                  {paginatedLogs.map((log, idx) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    const catMeta = logCategoryMeta[log.title] || {
                      short: log.title,
                      labelUrdu: log.title,
                      labelEn: log.title,
                      icon: '📝',
                    };
                    const dt = formatLogDateTime(log.timestamp, isUrdu);

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        {/* Index */}
                        <td className="py-2 px-3 text-center font-numbers text-slate-400 font-bold">
                          {rowNumber}
                        </td>

                        {/* Date & Time */}
                        <td className="py-2 px-3 text-center">
                          <div className="text-[11px] font-bold text-slate-900 font-numbers leading-tight">
                            {dt.date}
                          </div>
                          <div className="text-[10px] text-slate-500 font-numbers tracking-tight mt-0.5">
                            {dt.time}
                          </div>
                        </td>

                        {/* Short Title / Category Badge */}
                        <td className="py-2 px-2 text-center">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-2xs"
                            style={{
                              backgroundColor:
                                log.title === 'LT'
                                  ? '#e0e7ff'
                                  : log.title === 'BL'
                                  ? '#dcfce7'
                                  : log.title === 'EX'
                                  ? '#ffe4e6'
                                  : log.title === 'CD'
                                  ? '#cffafe'
                                  : log.title === 'BK'
                                  ? '#f3e8ff'
                                  : log.title === 'VP'
                                  ? '#ccfbf1'
                                  : '#f1f5f9',
                              color:
                                log.title === 'LT'
                                  ? '#3730a3'
                                  : log.title === 'BL'
                                  ? '#166534'
                                  : log.title === 'EX'
                                  ? '#9f1239'
                                  : log.title === 'CD'
                                  ? '#155e75'
                                  : log.title === 'BK'
                                  ? '#6b21a8'
                                  : log.title === 'VP'
                                  ? '#115e59'
                                  : '#334155',
                            }}
                          >
                            <span className="font-mono font-black">{catMeta.short}</span>
                            <span>{catMeta.icon}</span>
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-2 px-2 text-center">
                          {log.status === 'created' ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/60 font-urdu-sans">
                              {isUrdu ? '✅ اندراج (Created)' : 'Created'}
                            </span>
                          ) : log.status === 'updated' ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300/60 font-urdu-sans">
                              {isUrdu ? '✏️ اپڈیٹ (Updated)' : 'Updated'}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300/60 font-urdu-sans">
                              {isUrdu ? '❌ حذف (Deleted)' : 'Deleted'}
                            </span>
                          )}
                        </td>

                        {/* Description */}
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 text-xs sm:text-[13px] leading-relaxed">
                            {log.description}
                          </div>
                          {log.entityId && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              ID: {log.entityId}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer with Pagination & Clear Action */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Clear logs button with confirmation */}
          <div className="flex items-center gap-2">
            {!showClearConfirm ? (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold font-urdu-sans text-rose-700 hover:bg-rose-100 transition flex items-center gap-1.5 border border-rose-200 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isUrdu ? 'تمام لاگز صاف کریں' : 'Clear All Logs'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 p-1 bg-rose-50 border border-rose-300 rounded-xl text-xs font-urdu-sans animate-in fade-in">
                <span className="text-rose-800 font-bold px-1.5">{isUrdu ? 'کیا آپ واقعی تمام لاگز حذف کرنا چاہتے ہیں؟' : 'Confirm clear all?'}</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs"
                >
                  {isUrdu ? 'ہاں، صاف کریں' : 'Yes, Clear'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs"
                >
                  {isUrdu ? 'منسوخ' : 'Cancel'}
                </button>
              </div>
            )}
          </div>

          {/* Integrated PaginationControls */}
          <div className="w-full sm:w-auto">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredLogs.length}
              pageSize={pageSize}
              onPageChange={(page) => {
                sound.playTick();
                setCurrentPage(page);
              }}
              onPageSizeChange={(newSize) => {
                sound.playTick();
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              isUrdu={isUrdu}
              itemName={isUrdu ? 'لاگز' : 'logs'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
