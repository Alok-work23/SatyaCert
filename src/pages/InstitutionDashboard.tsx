import React, { useCallback, useEffect, useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { api, InstitutionRecord } from '../services/api';
import { formatDate } from '../components/VerificationHistory';
import UploadDoc from './UploadDoc';

interface Props {
  institutionName?: string;
}

export const InstitutionDashboard: React.FC<Props> = ({ institutionName }) => {
  const [records, setRecords] = useState<InstitutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRecords = useCallback(() => {
    setError('');
    api.getInstitutionRecords()
      .then(setRecords)
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load records.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(loadRecords, [loadRecords]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-serif">
            Welcome, {institutionName || "Institution"}
          </h1>
          <p className="text-sm text-gray-500">Upload authentic marksheets so certificates can be verified against them.</p>
        </div>

        <div className="bg-blue-50 text-gov-blue px-4 py-2 rounded border border-blue-200 font-mono text-sm">
          Status: <span className="text-green-600 font-bold">ACTIVE</span>
        </div>
      </div>

      <UploadDoc onUploaded={loadRecords} />

      {/* RECORDS UPLOADED BY THIS INSTITUTION */}
      <div className="bg-white rounded shadow overflow-hidden mt-10">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <Database size={18} /> Uploaded Records ({records.length})
          </h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gov-blue" /></div>
        ) : error ? (
          <div className="px-6 py-8 text-center text-red-600 text-sm">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Roll No', 'Semester', 'Student', 'CGPA', 'Uploaded'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((r, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{r.roll_no ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{r.semester ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{r.name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{r.cgpa ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(r.uploaded_at)}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No records uploaded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
