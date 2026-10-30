import React from "react";
import { FileUp } from "lucide-react";
import { VerificationHistory } from "../components/VerificationHistory";

interface OrganisationDashboardProps {
  organisationName?: string;
  onVerifyClick: () => void;
}

export const OrganisationDashboard: React.FC<OrganisationDashboardProps> = ({
  organisationName,
  onVerifyClick,
}) => (
  <div className="max-w-7xl mx-auto px-4 py-8">
    {/* Header */}
    <div className="mb-8 flex justify-between items-end">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-serif">
          {organisationName || "Organisation"} Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Verify candidate certificates and keep a record of every check.
        </p>
      </div>
      <button
        onClick={onVerifyClick}
        className="bg-gov-blue text-white px-6 py-2 rounded shadow font-semibold flex items-center gap-2"
      >
        <FileUp size={18} /> Verify a Certificate
      </button>
    </div>

    <VerificationHistory />
  </div>
);
