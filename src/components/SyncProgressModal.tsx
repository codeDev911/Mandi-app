import React from 'react';
import { SyncProgressState } from '../types';
import {
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ArrowUpRight,
  ArrowDownRight,
  HardDrive,
  Clock,
  Zap,
} from 'lucide-react';

export interface SyncProgressModalProps {
  isOpen: boolean;
  progress: SyncProgressState | null;
  onClose: () => void;
  onRetry?: () => void;
}

export const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
  isOpen,
  progress,
  onClose,
  onRetry,
}) => {
  if (!isOpen || !progress) return null;

  const isUpload = progress.direction === 'upload';
  const isCompleted = progress.stage === 'completed';
  const isError = progress.stage === 'error';

  // Format bytes nicely (KB, MB, GB)
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const loadedStr = formatBytes(progress.loadedBytes);
  const totalStr = progress.totalBytes > 0 ? formatBytes(progress.totalBytes) : 'Calculating...';
  const remainingBytes = Math.max(0, progress.totalBytes - progress.loadedBytes);
  const remainingStr = progress.totalBytes > 0 ? formatBytes(remainingBytes) : '---';

  const speedStr =
    progress.speedBytesPerSec > 0
      ? `${(progress.speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
      : '---';

  const formatTime = (secs: number): string => {
    if (!secs || secs <= 0) return 'Few seconds';
    if (secs >= 60) {
      const mins = Math.floor(secs / 60);
      const rem = secs % 60;
      return `${mins}m ${rem > 0 ? `${rem}s` : ''}`;
    }
    return `${secs}s`;
  };

  const percent = Math.min(100, Math.max(0, Math.round(progress.percentage || 0)));

  return (
    <div
      dir="ltr"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 font-sans">
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0 transition-colors ${
                isCompleted
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isError
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : isUpload
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-blue-600 text-white shadow-blue-500/20'
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              ) : isError ? (
                <AlertCircle className="w-6 h-6 stroke-[2.5]" />
              ) : isUpload ? (
                <CloudUpload className="w-6 h-6 animate-pulse" />
              ) : (
                <CloudDownload className="w-6 h-6 animate-pulse" />
              )}
            </div>

            <div>
              <h3 className="font-bold text-base sm:text-lg text-white leading-tight">
                {isCompleted
                  ? isUpload
                    ? 'Data Uploaded Successfully to Cloud!'
                    : 'Data Downloaded & Restored Successfully!'
                  : isError
                  ? 'Data Transfer Incomplete'
                  : isUpload
                  ? 'Uploading Data to S3 Cloud...'
                  : 'Downloading Data from S3 Cloud...'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isCompleted
                  ? 'All records are synchronized with S3 Object Storage'
                  : isError
                  ? 'Connection or transfer encountered an issue'
                  : isUpload
                  ? 'Packaging and securely uploading store records'
                  : 'Retrieving and syncing records from cloud storage'}
              </p>
            </div>
          </div>

          {(isCompleted || isError) && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Main Progress Bar & Percentage */}
          {!isCompleted && !isError && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>
                    {progress.message ||
                      (progress.stage === 'preparing'
                        ? 'Preparing & packaging data...'
                        : progress.stage === 'verifying'
                        ? 'Verifying & finalizing records...'
                        : isUpload
                        ? 'Transferring data to S3...'
                        : 'Receiving data from S3...')}
                  </span>
                </span>
                <span className="font-black font-mono text-base sm:text-lg text-emerald-400">
                  {percent}%
                </span>
              </div>

              {/* Glowing Progress Track */}
              <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 relative shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out relative ${
                    isUpload
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                  }`}
                  style={{ width: `${percent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                </div>
              </div>
            </div>
          )}

          {/* Metric Cards Grid */}
          {!isCompleted && !isError && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Transferred */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  {isUpload ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span>{isUpload ? 'Uploaded' : 'Downloaded'}</span>
                </div>
                <div className="mt-1">
                  <div className="font-bold text-sm font-mono text-white">{loadedStr}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    Total: {totalStr}
                  </div>
                </div>
              </div>

              {/* Remaining */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                  <span>Remaining</span>
                </div>
                <div className="mt-1">
                  <div className="font-bold text-sm font-mono text-amber-300">
                    {remainingStr}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {remainingBytes > 0 ? 'Left' : 'Finishing'}
                  </div>
                </div>
              </div>

              {/* Speed */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                  <span>Speed</span>
                </div>
                <div className="mt-1">
                  <div className="font-bold text-sm font-mono text-sky-300">
                    {speedStr}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Real-time
                  </div>
                </div>
              </div>

              {/* Estimated Time Remaining */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Est. Time</span>
                </div>
                <div className="mt-1">
                  <div className="font-bold text-sm text-purple-300 truncate">
                    {formatTime(progress.estimatedSecondsLeft)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Time left
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Phase Steps */}
          {!isCompleted && !isError && (
            <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-bold text-slate-300">Transfer Phases & Progress:</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">
                  {percent < 15 ? 'Step 1 of 3' : percent < 90 ? 'Step 2 of 3' : 'Step 3 of 3'}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      percent >= 10 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
                    }`}
                  />
                  <span className={percent >= 10 ? 'text-emerald-300 font-bold' : 'text-slate-500'}>
                    1. Data validation, packaging & encoding
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      percent >= 15 && percent < 95
                        ? 'bg-emerald-400 animate-ping'
                        : percent >= 95
                        ? 'bg-emerald-400'
                        : 'bg-slate-600'
                    }`}
                  />
                  <span
                    className={
                      percent >= 15 && percent < 95
                        ? 'text-emerald-300 font-bold'
                        : percent >= 95
                        ? 'text-slate-300'
                        : 'text-slate-500'
                    }
                  >
                    2. S3 Object Storage transfer (byte stream)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      percent >= 95 ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                  />
                  <span className={percent >= 95 ? 'text-emerald-300 font-bold' : 'text-slate-500'}>
                    3. Final verification & local integration
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* COMPLETED SUCCESS STATE */}
          {isCompleted && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div>
                <h4 className="font-bold text-base text-emerald-300">
                  {isUpload ? 'Cloud Backup Completed!' : 'Cloud Records Restored Successfully!'}
                </h4>
                <p className="text-xs text-emerald-400/80 mt-0.5">
                  Total Transferred Size: <span className="font-mono font-bold">{loadedStr}</span>
                </p>
              </div>

              {/* Summary Stats Grid */}
              {progress.resultSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-800/40 text-center">
                  <div className="p-2 bg-emerald-900/30 rounded-xl border border-emerald-700/30">
                    <span className="text-[10px] text-emerald-400 block font-medium">Lots</span>
                    <strong className="text-sm font-bold font-mono text-white">
                      {progress.resultSummary.lotsCount ?? 0}
                    </strong>
                  </div>
                  <div className="p-2 bg-emerald-900/30 rounded-xl border border-emerald-700/30">
                    <span className="text-[10px] text-emerald-400 block font-medium">Buyers</span>
                    <strong className="text-sm font-bold font-mono text-white">
                      {progress.resultSummary.customersCount ?? 0}
                    </strong>
                  </div>
                  <div className="p-2 bg-emerald-900/30 rounded-xl border border-emerald-700/30">
                    <span className="text-[10px] text-emerald-400 block font-medium">Vendors</span>
                    <strong className="text-sm font-bold font-mono text-white">
                      {progress.resultSummary.vendorsCount ?? 0}
                    </strong>
                  </div>
                  <div className="p-2 bg-emerald-900/30 rounded-xl border border-emerald-700/30">
                    <span className="text-[10px] text-emerald-400 block font-medium">Expenses</span>
                    <strong className="text-sm font-bold font-mono text-white">
                      {progress.resultSummary.expensesCount ?? 0}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ERROR STATE */}
          {isError && (
            <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-2xl space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-rose-300">Transfer Incomplete</h4>
                  <p className="text-rose-200/90 leading-relaxed">
                    {progress.error || progress.message || 'Connection or server response issue encountered.'}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-rose-800/40 flex items-center justify-end gap-2">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Transfer</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Bottom Action for Completed State */}
          {isCompleted && (
            <button
              onClick={onClose}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm transition shadow-lg shadow-emerald-600/30 active:scale-98 cursor-pointer"
            >
              Done (Close)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
