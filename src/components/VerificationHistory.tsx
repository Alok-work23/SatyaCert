import React, { useEffect, useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { api, VerificationLogEntry, VerificationOutcome } from '../services/api';

export const OUTCOME_STYLES: Record<VerificationOutcome, { label: string; className: string }> = {
  AUTHENTIC:  { label: 'Authentic',        className: 'bg-green-100 text-green-800' },
  SUSPICIOUS: { label: 'Suspicious',       className: 'bg-amber-100 text-amber-800' },
  FORGED:     { label: 'Forgery detected', className: 'bg-red-100 text-red-800' },
  NOT_FOUND:  { label: 'No record',        className: 'bg-gray-100 text-gray-700' },
};

export const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');

interface VerificationTableProps {
  rows: VerificationLogEntry[];
  emptyText?: string;
}

// Table of verification log entries; shared by citizen, organisation and admin dashboards
export const VerificationTable: React.FC<VerificationTableProps> = ({ rows, emptyText = 'No verifications yet.' }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {['Date', 'Roll No', 'Semester', 'Student', 'Method', 'Result'].map(h => (
            <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {rows.map((row, i) => {
          const outcome = OUTCOME_STYLES[row.result] ?? OUTCOME_STYLES.NOT_FOUND;
          return (
            <tr key={i}>
              <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{formatDate(row.created_at)}</td>
              <td className="px-6 py-4 text-sm font-mono text-gray-900">{row.roll_no ?? '—'}</td>
              <td className="px-6 py-4 text-sm text-gray-700">{row.semester ?? '—'}</td>
              <td className="px-6 py-4 text-sm text-gray-700">{row.student_name || '—'}</td>
              <td className="px-6 py-4 text-sm text-gray-500">{row.source === 'manual' ? 'Manual entry' : row.source === 'qr' ? 'QR scan' : row.file_name || 'PDF upload'}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 text-xs font-bold rounded ${outcome.className}`}>{outcome.label}</span>
              </td>
            </tr>
          );
        })}
        {rows.length === 0 && (
          <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">{emptyText}</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

// The signed-in user's own verification history, loaded from the backend
export const VerificationHistory: React.FC = () => {
  const [rows, setRows] = useState<VerificationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMyVerifications()
      .then(setRows)
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load history.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-bold text-gray-700 flex items-center gap-2"><Clock size={18} /> Verification History</h3>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gov-blue" /></div>
      ) : error ? (
        <div className="px-6 py-8 text-center text-red-600 text-sm">{error}</div>
      ) : (
        <VerificationTable rows={rows} />
      )}
    </div>
  );
};
