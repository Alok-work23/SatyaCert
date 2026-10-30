import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Loader2, X } from 'lucide-react';
import { api, InstitutionRecord } from '../services/api';

interface Props {
  record: InstitutionRecord;
  onClose: () => void;
}

// Shows the signed QR code for a record, ready to download and print on the certificate
export const CertificateQrModal: React.FC<Props> = ({ record, onClose }) => {
  const [link, setLink] = useState('');
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getRecordQrToken(record.roll_no ?? '', record.semester ?? '')
      .then(async token => {
        const url = `${window.location.origin}/v/${token}`;
        setLink(url);
        setImage(await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 320 }));
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not create the QR code.'));
  }, [record]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 px-4">
      <div className="bg-white w-full max-w-sm p-6 rounded-xl shadow-lg relative text-center">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-500 hover:text-black" title="Close">
          <X size={20} />
        </button>

        <h2 className="text-lg font-bold text-gray-800">Certificate QR code</h2>
        <p className="text-sm text-gray-500 mb-4">
          {record.name || 'Student'} · Roll {record.roll_no} · Sem {record.semester}
        </p>

        {error ? (
          <p className="text-red-600 text-sm py-10">{error}</p>
        ) : !image ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gov-blue" /></div>
        ) : (
          <>
            <img src={image} alt="Signed verification QR code" className="mx-auto w-64 h-64" />
            <p className="text-xs text-gray-500 mt-3 mb-5">
              Print this on the certificate, at least 3 cm wide. Anyone who scans it can confirm the details were issued by your
              institution through SatyaCert. Re-uploading the record makes older QR codes show as outdated.
            </p>
            <div className="flex justify-center gap-3">
              <a
                href={image}
                download={`satyacert-${record.roll_no}-sem${record.semester}.png`}
                className="bg-gov-blue text-white px-4 py-2 rounded shadow font-semibold flex items-center gap-2 text-sm"
              >
                <Download size={16} /> Download
              </a>
              <button
                onClick={copyLink}
                className="border border-gray-300 px-4 py-2 rounded font-semibold flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Copy size={16} /> {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
