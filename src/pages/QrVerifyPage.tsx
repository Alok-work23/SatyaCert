import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { api, QrStatus, QrVerification } from '../services/api';

const STATUS_VIEW: Record<QrStatus, { title: string; text: string; className: string; icon: React.ReactNode }> = {
  VALID: {
    title: 'Genuine certificate',
    text: 'This QR code was issued through SatyaCert and matches the institution\'s current record.',
    className: 'text-green-700 bg-green-50 border-green-300',
    icon: <CheckCircle className="w-7 h-7 text-green-600 flex-shrink-0" />,
  },
  OUTDATED: {
    title: 'Record has changed',
    text: 'This QR code is genuine, but the institution has updated the record since it was issued. Ask the holder for a current certificate.',
    className: 'text-amber-700 bg-amber-50 border-amber-300',
    icon: <AlertCircle className="w-7 h-7 text-amber-600 flex-shrink-0" />,
  },
  REVOKED: {
    title: 'Record withdrawn',
    text: 'This QR code is genuine, but the institution no longer has this record on file.',
    className: 'text-amber-700 bg-amber-50 border-amber-300',
    icon: <AlertCircle className="w-7 h-7 text-amber-600 flex-shrink-0" />,
  },
  INVALID: {
    title: 'Not a valid SatyaCert code',
    text: 'This QR code was not issued by SatyaCert or has been tampered with. Treat the certificate as unverified.',
    className: 'text-red-700 bg-red-50 border-red-300',
    icon: <XCircle className="w-7 h-7 text-red-600 flex-shrink-0" />,
  },
};

// Public landing page for a scanned certificate QR code (/v/<token>)
export const QrVerifyPage: React.FC<{ token: string }> = ({ token }) => {
  const [result, setResult] = useState<QrVerification | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.verifyQr(token)
      .then(setResult)
      .catch(e => setError(e instanceof Error ? e.message : 'Verification service unavailable.'));
  }, [token]);

  if (error) {
    return <div className="max-w-xl mx-auto px-4 py-16 text-center text-red-600">{error}</div>;
  }
  if (!result) {
    return <div className="flex justify-center py-24"><Loader2 size={40} className="animate-spin text-gov-blue" /></div>;
  }

  const view = STATUS_VIEW[result.status];
  const cert = result.certificate;
  const rows: [string, string | number | undefined][] = cert ? [
    ['Student', cert.name], ['Roll No', cert.roll], ['Semester', cert.sem], ['University', cert.uni],
    ['SGPA', cert.sgpa], ['CGPA', cert.cgpa], ['Result', cert.result],
    ['Issued', result.issued_at ? new Date(result.issued_at).toLocaleDateString() : undefined],
  ] : [];

  return (
    <div className="max-w-xl mx-auto px-4 py-12 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 font-serif text-center mb-6">Certificate Verification</h1>

      <div className={`rounded-xl border-2 p-6 ${view.className}`}>
        <div className="flex items-center gap-3 mb-2">
          {view.icon}
          <span className="font-bold text-lg">{view.title}</span>
        </div>
        <p className="text-sm">{result.reason ?? view.text}</p>
      </div>

      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
            <h3 className="font-bold text-gray-700 text-sm">Details signed into this QR code</h3>
          </div>
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            {rows.map(([label, value]) => (
              <div key={label} className="bg-white px-5 py-3">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">{label}</p>
                <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        Compare these details with the printed certificate — they must match exactly.
      </p>
    </div>
  );
};
