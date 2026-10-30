import React from 'react';
import { FileText } from 'lucide-react';
import { VerificationHistory } from '../components/VerificationHistory';

interface UserDashboardProps { onVerifyClick: () => void; }

export const UserDashboard: React.FC<UserDashboardProps> = ({ onVerifyClick }) => (
  <div className="max-w-7xl mx-auto px-4 py-8">
    <div className="mb-8 flex justify-between items-end">
      <div><h1 className="text-2xl font-bold text-gray-900 font-serif">My Dashboard</h1><p className="text-sm text-gray-500">Track your certificate verifications.</p></div>
      <button onClick={onVerifyClick} className="bg-gov-blue text-white px-6 py-2 rounded shadow font-semibold flex items-center gap-2"><FileText size={18} /> New Verification</button>
    </div>
    <VerificationHistory />
  </div>
);
