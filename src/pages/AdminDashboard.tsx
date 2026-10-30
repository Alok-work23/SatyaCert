import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { api, AdminStats } from '../services/api';
import { Institution } from '../types';
import { VerificationTable } from '../components/VerificationHistory';
import { Check, X, AlertTriangle, Eye, Trash2 } from 'lucide-react';

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleString(undefined, { month: 'short', year: '2-digit' });

export const AdminDashboard: React.FC = () => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    fetchInstitutions();
    api.getAdminStats()
      .then(setStats)
      .catch(e => setStatsError(e instanceof Error ? e.message : 'Could not load statistics.'));
  }, []);

  const fetchInstitutions = async () => {
    const data = await api.getAllInstitutions();
    setInstitutions(data);
  };

  const handleStatusUpdate = async (id: string, status: 'ACTIVE' | 'REJECTED') => {
    await api.updateInstitutionStatus(id, status);
    setSelectedInst(null);
    fetchInstitutions();
  };

  const handleDelete = async (inst: Institution) => {
    if (!window.confirm(`Permanently delete ${inst.name}? They will lose upload access.`)) return;
    await api.deleteInstitution(inst.id);
    fetchInstitutions();
  };

  const pendingInstitutions = institutions.filter(i => i.status === 'PENDING');
  const approvedInstitutions = institutions.filter(i => i.status === 'ACTIVE');
  const fmt = (n?: number) => (stats ? (n ?? 0).toLocaleString() : '—');

  const statCards = [
    { label: 'Total Verifications', value: fmt(stats?.total), border: 'border-gov-blue', text: '' },
    { label: 'Forgeries Detected', value: fmt(stats?.by_result.FORGED), border: 'border-red-500', text: 'text-red-600' },
    { label: 'Suspicious', value: fmt(stats?.by_result.SUSPICIOUS), border: 'border-amber-500', text: 'text-amber-600' },
    { label: 'Pending Approvals', value: pendingInstitutions.length.toLocaleString(), border: 'border-gov-orange', text: 'text-orange-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      <h1 className="text-2xl font-bold text-gray-900 font-serif mb-8"> Ministry of Education Jharkhand</h1>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className={`bg-white p-4 rounded shadow border-t-4 ${card.border}`}>
            <div className="text-gray-500 text-xs font-bold uppercase mb-1">{card.label}</div>
            <div className={`text-2xl font-bold ${card.text}`}>{card.value}</div>
          </div>
        ))}
      </div>
      {statsError && (
        <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200 mb-8">{statsError}</div>
      )}

      {/* FIXED 2-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT SIDE — ALWAYS 2/3 WIDTH */}
        <div className="lg:col-span-2">

          {/* Pending Box */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg mb-8 p-6">
            <h3 className="text-lg font-bold text-orange-800 mb-4 flex items-center gap-2">
              <AlertTriangle size={20} /> Applications Pending Approval
            </h3>

            <div className="bg-white rounded shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Institution</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">District</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {pendingInstitutions.length > 0 ? (
                    pendingInstitutions.map(inst => (
                      <tr key={inst.id}>
                        <td className="px-6 py-4 font-bold text-gray-900">{inst.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{inst.district || '—'}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedInst(inst)}
                            className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                        No pending applications.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* CHART */}
          <div className="bg-white p-6 rounded shadow h-80">
            <h3 className="font-bold text-gray-700 mb-4">Verification Volume (last 6 months)</h3>
            {stats && stats.monthly.length === 0 ? (
              <p className="text-gray-500 text-sm">No verifications recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={(stats?.monthly ?? []).map(m => ({ ...m, name: monthLabel(m.name) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Verifications" fill="#1e3a8a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* RIGHT SIDE — FIXED APPROVED LIST */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded shadow h-full border-t-4 border-gov-blue">
            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Check size={20} className='text-gov-blue' /> Approved Institutions ({approvedInstitutions.length})
            </h3>

            <div className="space-y-3 max-h-[560px] overflow-y-auto">

              {approvedInstitutions.length > 0 ? (
                approvedInstitutions.map(inst => (
                  <div
                    key={inst.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200"
                  >
                    <span className="font-medium text-sm text-gray-800">{inst.name}</span>

                    <div className="flex gap-1">
                      <button
                        onClick={() => setSelectedInst(inst)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        onClick={() => handleDelete(inst)}
                        className="text-red-600 hover:text-red-800 p-1 rounded"
                        title="Permanently Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic text-sm">No institutions approved yet.</p>
              )}

            </div>
          </div>
        </div>

      </div>

      {/* REVIEW MODAL */}
      {selectedInst && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 px-4">
          <div className="bg-white w-full max-w-[450px] p-5 rounded-xl shadow-lg">

            <h2 className="text-xl font-bold mb-4">Review Institution</h2>

            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {selectedInst.name}</p>
              <p><strong>Code:</strong> {selectedInst.code}</p>
              <p><strong>Type:</strong> {selectedInst.type}</p>
              <p><strong>District:</strong> {selectedInst.district}</p>
              <p><strong>Address:</strong> {selectedInst.address}</p>
              <p><strong>Principal:</strong> {selectedInst.principalName}</p>
              <p><strong>Email:</strong> {selectedInst.contactEmail}</p>
              <p><strong>Mobile:</strong> {selectedInst.mobile}</p>
              <p><strong>Status:</strong> {selectedInst.status}</p>
            </div>

            <div className="flex justify-between mt-6">
              {selectedInst.status !== 'ACTIVE' && (
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-1"
                  onClick={() => handleStatusUpdate(selectedInst.id, 'ACTIVE')}
                >
                  <Check size={18} /> Approve
                </button>
              )}

              <button
                className="px-4 py-2 bg-red-600 text-white rounded flex items-center gap-1"
                onClick={() => handleStatusUpdate(selectedInst.id, 'REJECTED')}
              >
                <X size={18} /> {selectedInst.status === 'ACTIVE' ? 'Revoke' : 'Reject'}
              </button>

              <button
                className="px-4 py-2 bg-gray-500 text-white rounded"
                onClick={() => setSelectedInst(null)}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* RECENT VERIFICATIONS */}
      <div className="bg-white rounded shadow overflow-hidden mt-10">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-gray-700">Recent Verifications</h3>
        </div>
        <VerificationTable rows={stats?.recent ?? []} emptyText={stats ? 'No verifications yet.' : 'Loading…'} />
      </div>

    </div>
  );
};
