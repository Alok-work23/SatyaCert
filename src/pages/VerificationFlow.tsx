import React, { useState, useEffect } from 'react';
import {
  Upload, AlertTriangle, Loader2, Send, Keyboard,
  CheckCircle, XCircle, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
enum VerificationStep {
  UPLOAD     = 0,
  PREVIEW    = 1,
  PROCESSING = 2,
  RESULT     = 3,
}

type VerificationMode = 'UPLOAD' | 'MANUAL';

interface FieldMismatch {
  field: string;
  uploaded_value: unknown;
  database_value: unknown;
}

interface Verdict {
  is_authentic: boolean;
  risk_level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
  total_mismatches: number;
  critical_mismatches: FieldMismatch[];
  non_critical_mismatches: FieldMismatch[];
}

interface Marksheet {
  student_info?:      { roll_no?: string; name?: string };
  academic_info?:     { course?: string; semester?: string; sgpa?: number; cgpa?: number; result_status?: string };
  document_metadata?: { university_name?: string };
}

interface VerificationApiResponse {
  uploaded_document:   { marksheet: Marksheet };
  database_record:     { marksheet: Marksheet };
  verification_result: { verdict: Verdict; diff: unknown };
}

interface Institution {
  id: string;
  name: string;
  status: string;
}
// ─────────────────────────────────────────────────────────────────────────────

// Works with Vite (VITE_API_URL) or plain CRA / any setup (fallback to localhost)
const API_BASE: string = (() => {
  try {
    return (import.meta as { env?: Record<string, string> }).env?.['VITE_API_URL'] ?? 'http://127.0.0.1:8000';
  } catch {
    return 'http://127.0.0.1:8000';
  }
})();

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MismatchTableProps {
  rows:    FieldMismatch[];
  variant: 'critical' | 'minor';
}

const MismatchTable: React.FC<MismatchTableProps> = ({ rows, variant }) => {
  const isCritical = variant === 'critical';
  const headerBg   = isCritical ? 'bg-red-50 border-red-200'    : 'bg-amber-50 border-amber-200';
  const wrapBorder  = isCritical ? 'border-red-200'              : 'border-amber-200';
  const headerText  = isCritical ? 'text-red-700'                : 'text-amber-700';
  const valueText   = isCritical ? 'text-red-600'                : 'text-amber-700';
  const title       = isCritical ? 'Critical mismatches'         : 'Minor mismatches';

  const fmtField = (f: string) =>
    f.replace(/^marksheet\./, '').replace(/\./g, ' › ').replace(/_/g, ' ');

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${wrapBorder}`}>
      <div className={`px-5 py-3 border-b ${headerBg}`}>
        <h3 className={`font-bold text-sm ${headerText}`}>
          {title} ({rows.length})
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
            <th className="text-left px-5 py-2">Field</th>
            <th className="text-left px-5 py-2">Uploaded</th>
            <th className="text-left px-5 py-2">Database</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-5 py-3 font-medium text-gray-700">{fmtField(m.field)}</td>
              <td className={`px-5 py-3 font-mono ${valueText}`}>{String(m.uploaded_value ?? '—')}</td>
              <td className="px-5 py-3 font-mono text-green-700">{String(m.database_value ?? '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface ResultPanelProps {
  data:      VerificationApiResponse;
  onReset:   () => void;
  onComplete: () => void;
}

const ResultPanel: React.FC<ResultPanelProps> = ({ data, onReset, onComplete }) => {
  const verdict  = data.verification_result.verdict;
  const uploaded = data.uploaded_document.marksheet;

  const riskBg = (level: Verdict['risk_level']): string => {
    if (level === 'NONE' || level === 'LOW') return 'text-green-700 bg-green-50 border-green-300';
    if (level === 'MEDIUM')                  return 'text-amber-700 bg-amber-50 border-amber-300';
    return 'text-red-700 bg-red-50 border-red-300';
  };

  const RiskIcon: React.FC = () => {
    if (verdict.risk_level === 'NONE' || verdict.risk_level === 'LOW')
      return <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />;
    if (verdict.risk_level === 'MEDIUM')
      return <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />;
    return <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />;
  };

  const infoRows: [string, string | number | undefined][] = [
    ['Roll No',    uploaded.student_info?.roll_no],
    ['Name',       uploaded.student_info?.name],
    ['Course',     uploaded.academic_info?.course],
    ['Semester',   uploaded.academic_info?.semester],
    ['SGPA',       uploaded.academic_info?.sgpa],
    ['CGPA',       uploaded.academic_info?.cgpa],
    ['Result',     uploaded.academic_info?.result_status],
    ['University', uploaded.document_metadata?.university_name],
  ];

  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      <div className={`rounded-xl border-2 p-6 ${riskBg(verdict.risk_level)}`}>
        <div className="flex items-center gap-3 mb-2">
          <RiskIcon />
          <span className="font-bold text-lg">
            {verdict.is_authentic ? 'Certificate authentic' : 'Potential forgery detected'}
          </span>
          <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full border ${riskBg(verdict.risk_level)}`}>
            {verdict.risk_level} RISK
          </span>
        </div>
        <p className="text-sm">{verdict.summary}</p>
      </div>

      {/* Critical mismatches */}
      {verdict.critical_mismatches.length > 0 && (
        <MismatchTable rows={verdict.critical_mismatches} variant="critical" />
      )}

      {/* Minor mismatches */}
      {verdict.non_critical_mismatches.length > 0 && (
        <MismatchTable rows={verdict.non_critical_mismatches} variant="minor" />
      )}

      {/* Extracted info grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
          <h3 className="font-bold text-gray-700 text-sm">Extracted details</h3>
        </div>
        <div className="grid grid-cols-2 gap-px bg-gray-100">
          {infoRows.map(([label, value]) => (
            <div key={label} className="bg-white px-5 py-3">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">{label}</p>
              <p className="text-sm font-medium text-gray-800">{String(value ?? '—')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onReset}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium"
        >
          Verify another
        </button>
        <button
          onClick={onComplete}
          className="px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-bold shadow"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface VerificationFlowProps {
  onComplete: () => void;
}

export const VerificationFlow: React.FC<VerificationFlowProps> = ({ onComplete }) => {
  const [step, setStep]     = useState<VerificationStep>(VerificationStep.UPLOAD);
  const [mode, setMode]     = useState<VerificationMode>('UPLOAD');
  const [file, setFile]     = useState<File | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [result, setResult] = useState<VerificationApiResponse | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [manualData, setManualData] = useState({
    certificateId: '',
    name: '',
    institutionId: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/institutions`);
        if (res.ok) {
          const data = (await res.json()) as Institution[];
          setInstitutions(data.filter(i => i.status === 'ACTIVE'));
        }
      } catch {
        // non-fatal — manual dropdown will be empty
      }
    };
    load();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) {
      setFile(picked);
      setError(null);
      setStep(VerificationStep.PREVIEW);
    }
  };

  const handleSubmission = async () => {
    if (mode === 'UPLOAD' && !file) {
      setError('Please select a PDF file first.');
      return;
    }
    setStep(VerificationStep.PROCESSING);
    setError(null);

    try {
      let response: Response;

      if (mode === 'UPLOAD' && file) {
        const formData = new FormData();
        formData.append('file_upload', file);
        response = await fetch(`${API_BASE}/verify/`, { method: 'POST', body: formData });
      } else {
        response = await fetch(`${API_BASE}/verify-manual/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(manualData),
        });
      }

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({})) as { detail?: string };
        throw new Error(errBody.detail ?? `Server error ${response.status}`);
      }

      const data = (await response.json()) as VerificationApiResponse;
      setResult(data);
      setStep(VerificationStep.RESULT);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred.');
      setStep(VerificationStep.UPLOAD);
    }
  };

  const resetFlow = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setManualData({ certificateId: '', name: '', institutionId: '' });
    setStep(VerificationStep.UPLOAD);
  };

  const STEPS = ['Upload', 'Preview', 'Analysing', 'Result'] as const;

  return (
    <div className="max-w-3xl mx-auto p-6">

      {/* Progress stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-4 w-full h-1 bg-gray-200 -z-10" />
          {STEPS.map((label, idx) => {
            const active = idx <= step;
            return (
              <div key={label} className="flex flex-col items-center bg-white px-2 z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                  active ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {idx + 1}
                </div>
                <span className={`text-xs mt-1 font-medium ${active ? 'text-blue-700' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Verification failed</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Step 1 — Upload / Manual */}
      {step === VerificationStep.UPLOAD && (
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            {(['UPLOAD', 'MANUAL'] as VerificationMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 ${
                  mode === m
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {m === 'UPLOAD'
                  ? <><Upload size={16} /> Upload PDF</>
                  : <><Keyboard size={16} /> Manual entry</>}
              </button>
            ))}
          </div>

          <div className="p-10">
            {mode === 'UPLOAD' ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-50 text-blue-700 rounded-full mx-auto flex items-center justify-center mb-6">
                  <Upload size={36} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload certificate</h2>
                <p className="text-gray-500 mb-8 max-w-sm mx-auto text-sm">
                  PDF marksheets only. The file is analysed and immediately deleted from our servers.
                </p>
                <label className="cursor-pointer inline-block bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-8 rounded-lg shadow transition-colors">
                  Choose PDF
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                </label>
              </div>
            ) : (
              <form
                onSubmit={e => { e.preventDefault(); void handleSubmission(); }}
                className="max-w-md mx-auto space-y-5"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Certificate ID</label>
                  <input
                    required
                    className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={manualData.certificateId}
                    onChange={e => setManualData({ ...manualData, certificateId: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student name</label>
                  <input
                    required
                    className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={manualData.name}
                    onChange={e => setManualData({ ...manualData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                  <select
                    required
                    className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={manualData.institutionId}
                    onChange={e => setManualData({ ...manualData, institutionId: e.target.value })}
                  >
                    <option value="">Select institution…</option>
                    {institutions.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-lg shadow"
                >
                  Submit for verification
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Step 2 — Preview */}
      {step === VerificationStep.PREVIEW && file && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-10 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-700 rounded-full mx-auto flex items-center justify-center mb-5">
            <Upload size={28} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Ready to verify</h3>
          <p className="text-gray-500 text-sm mb-4">Selected file:</p>
          <div className="bg-gray-100 border border-gray-200 rounded-lg px-6 py-3 inline-block mb-2 font-mono text-sm text-gray-700">
            {file.name}
          </div>
          <p className="text-xs text-gray-400 mb-8">{(file.size / 1024).toFixed(1)} KB · PDF</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={resetFlow}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => { void handleSubmission(); }}
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-8 rounded-lg shadow flex items-center gap-2"
            >
              <Send size={16} /> Verify now
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Processing */}
      {step === VerificationStep.PROCESSING && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-16 text-center">
          <Loader2 size={56} className="text-blue-700 animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Analysing certificate…</h2>
          <p className="text-sm text-gray-500">
            Extracting fields, querying institutional records, and comparing.
          </p>
        </div>
      )}

      {/* Step 4 — Result */}
      {step === VerificationStep.RESULT && result && (
        <ResultPanel data={result} onReset={resetFlow} onComplete={onComplete} />
      )}
    </div>
  );
};