import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { api, AdminStats } from '../services/api';
import { VerificationTable } from '../components/VerificationHistory';
import { Check, X, AlertTriangle, Eye, Trash2, Building2, Briefcase } from 'lucide-react';

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleString(undefined, { month: 'short', year: '2-digit' });

type ApplicantKind = 'institution' | 'organisation';
type ApplicantStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';

// Institutions and organisations go through the same approval flow
interface Applicant {
  kind: ApplicantKind;
  id: string;
  name: string;
  status: ApplicantStatus;
  subtitle: string;
  details: [string, string | undefined][];
}

const KIND_LABEL: Record<ApplicantKind, string> = { institution: 'Institution', organisation: 'Organisation' };

const loadApplicants = async (): Promise<Applicant[]> => {
  const [institutions, organisations] = await Promise.all([api.getAllInstitutions(), api.getAllOrganisations()]);
  return [
    ...institutions.map((i): Applicant => ({
      kind: 'institution', id: i.id, name: i.name, status: i.status, subtitle: i.district || '—',
      details: [
        ['Code', i.code], ['Type', i.type], ['District', i.district], ['Address', i.address],
        ['Principal', i.principalName], ['Email', i.contactEmail], ['Mobile', i.mobile],
      ],
    })),
    ...organisations.map((o): Applicant => ({
      kind: 'organisation', id: o.id, name: o.name, status: o.status, subtitle: o.contactName || '—',
      details: [['Contact person', o.contactName], ['Email', o.email], ['Mobile', o.mobileNo]],
    })),
  ];
};

const setStatus = (a: Applicant, status: 'ACTIVE' | 'REJECTED') =>
  a.kind === 'institution' ? api.updateInstitutionStatus(a.id, status) : api.updateOrganisationStatus(a.id, status);

const remove = (a: Applicant) =>
  a.kind === 'institution' ? api.deleteInstitution(a.id) : api.deleteOrganisation(a.id);

const ApprovedList: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: Applicant[];
  onView: (a: Applicant) => void;
  onDelete: (a: Applicant) => void;
}> = ({ title, icon, items, onView, onDelete }) => (
  <div className="bg-white p-6 rounded shadow border-t-4 border-gov-blue">
    <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
      {icon} {title} ({items.length})
    </h3>
    <div className="space-y-3 max-h-[260px] overflow-y-auto">
      {items.length > 0 ? (
        items.map(a => (
          <div key={a.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200">
            <span className="font-medium text-sm text-gray-800">{a.name}</span>
            <div className="flex gap-1">
              <button onClick={() => onView(a)} className="text-blue-600 hover:text-blue-800 p-1 rounded" title="View Details">
                <Eye size={16} />
              </button>
              <button onClick={() => onDelete(a)} className="text-red-600 hover:text-red-800 p-1 rounded" title="Permanently Delete">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className="text-gray-500 italic text-sm">None approved yet.</p>
      )}
    </div>
  </div>
);

export const AdminDashboard: React.FC = () => {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [selected, setSelected] = useState<Applicant | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState('');

  const refresh = async () => setApplicants(await loadApplicants());

  useEffect(() => {
    refresh();
    api.getAdminStats()
      .then(setStats)
      .catch(e => setStatsError(e instanceof Error ? e.message : 'Could not load statistics.'));
  }, []);

  const handleStatusUpdate = async (a: Applicant, status: 'ACTIVE' | 'REJECTED') => {
    await setStatus(a, status);
    setSelected(null);
    refresh();
  };

  const handleDelete = async (a: Applicant) => {
    if (!window.confirm(`Permanently delete ${a.name}? They will lose access.`)) return;
    await remove(a);
    refresh();
  };

  const pending = applicants.filter(a => a.status === 'PENDING');
  const approved = (kind: ApplicantKind) => applicants.filter(a => a.kind === kind && a.status === 'ACTIVE');
  const fmt = (n?: number) => (stats ? (n ?? 0).toLocaleString() : '—');

  const statCards = [
    { label: 'Total Verifications', value: fmt(stats?.total), border: 'border-gov-blue', text: '' },
    { label: 'Forgeries Detected', value: fmt(stats?.by_result.FORGED), border: 'border-red-500', text: 'text-red-600' },
    { label: 'Suspicious', value: fmt(stats?.by_result.SUSPICIOUS), border: 'border-amber-500', text: 'text-amber-600' },
    { label: 'Pending Approvals', value: pending.length.toLocaleString(), border: 'border-gov-orange', text: 'text-orange-600' },
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

            <div className="bg-white rounded shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applicant</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">District / Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {pending.length > 0 ? (
                    pending.map(a => (
                      <tr key={`${a.kind}-${a.id}`}>
                        <td className="px-6 py-4 font-bold text-gray-900">{a.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{KIND_LABEL[a.kind]}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{a.subtitle}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelected(a)}
                            className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
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

        {/* RIGHT SIDE — APPROVED LISTS */}
        <div className="lg:col-span-1 space-y-6">
          <ApprovedList
            title="Approved Institutions"
            icon={<Building2 size={20} className="text-gov-blue" />}
            items={approved('institution')}
            onView={setSelected}
            onDelete={handleDelete}
          />
          <ApprovedList
            title="Approved Organisations"
            icon={<Briefcase size={20} className="text-gov-blue" />}
            items={approved('organisation')}
            onView={setSelected}
            onDelete={handleDelete}
          />
        </div>

      </div>

      {/* REVIEW MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 px-4">
          <div className="bg-white w-full max-w-[450px] p-5 rounded-xl shadow-lg">

            <h2 className="text-xl font-bold mb-4">Review {KIND_LABEL[selected.kind]}</h2>

            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {selected.name}</p>
              {selected.details.map(([label, value]) => (
                <p key={label}><strong>{label}:</strong> {value || '—'}</p>
              ))}
              <p><strong>Status:</strong> {selected.status}</p>
            </div>

            <div className="flex justify-between mt-6">
              {selected.status !== 'ACTIVE' && (
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-1"
                  onClick={() => handleStatusUpdate(selected, 'ACTIVE')}
                >
                  <Check size={18} /> Approve
                </button>
              )}

              <button
                className="px-4 py-2 bg-red-600 text-white rounded flex items-center gap-1"
                onClick={() => handleStatusUpdate(selected, 'REJECTED')}
              >
                <X size={18} /> {selected.status === 'ACTIVE' ? 'Revoke' : 'Reject'}
              </button>

              <button
                className="px-4 py-2 bg-gray-500 text-white rounded"
                onClick={() => setSelected(null)}
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
