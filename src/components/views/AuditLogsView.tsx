import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { AuditLog } from '../../types';
import { 
  History, 
  Search, 
  Filter, 
  ShieldCheck, 
  Clock, 
  FileText, 
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AuditLogsViewProps {
  auditLogs: AuditLog[];
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ auditLogs }) => {
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (filterType !== 'ALL' && log.recordType !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const mAction = log.action.toLowerCase().includes(q);
        const mMod = log.modifiedBy.toLowerCase().includes(q);
        const mEid = (log.eid || '').toLowerCase().includes(q);
        const mReason = (log.reason || '').toLowerCase().includes(q);
        if (!mAction && !mMod && !mEid && !mReason) return false;
      }
      return true;
    });
  }, [auditLogs, filterType, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedLogId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {t('navAuditLogs')}
              </h1>
              <p className="text-xs text-slate-500">
                Permanent, immutable audit trail of all attendance corrections, employee updates, monthly locks, and HR verifications.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-purple-800 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200">
          <ShieldCheck className="w-4 h-4 text-purple-600" />
          <span>Append-Only Trail Active</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search action, user, EID, reason..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700"
          >
            <option value="ALL">All Record Types</option>
            <option value="Attendance">Attendance</option>
            <option value="Employee">Employee</option>
            <option value="Leave">Leave</option>
            <option value="Lock">Lock</option>
            <option value="Register">Register</option>
          </select>
        </div>

        <span className="text-[11px] font-medium text-slate-400">
          {filteredLogs.length} audit entries
        </span>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Target EID / ID</th>
                <th className="px-4 py-3">Modified By</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                    No audit records matching current search.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {new Date(log.modifiedAt).toLocaleString('en-GB')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {log.recordType}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 font-medium">
                          {log.eid || log.recordId}
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          {log.modifiedBy}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {log.reason || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(log.previousValue || log.newValue) && (
                            <button
                              onClick={() => toggleExpand(log.id)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800"
                              title="Toggle Details"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Diff Viewer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                              {log.previousValue && (
                                <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-lg">
                                  <span className="font-bold text-rose-800 block mb-1">Previous Value:</span>
                                  <pre className="font-mono text-rose-900 overflow-x-auto whitespace-pre-wrap">
                                    {log.previousValue}
                                  </pre>
                                </div>
                              )}
                              {log.newValue && (
                                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg">
                                  <span className="font-bold text-emerald-800 block mb-1">New Value:</span>
                                  <pre className="font-mono text-emerald-900 overflow-x-auto whitespace-pre-wrap">
                                    {log.newValue}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
