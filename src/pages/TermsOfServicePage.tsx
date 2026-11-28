import React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { PolicyDocumentView } from '../components/policy/PolicyDocumentView';
import { navigatePath } from '../app/router/browser';

interface TermsOfServicePageProps {
  onBack?: () => void;
}

export const TermsOfServicePage: React.FC<TermsOfServicePageProps> = ({ onBack }) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigatePath('/');
    }
  };

  return (
    <div className="min-h-[75vh] bg-[#faf8f5] py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Breadcrumb & Back Action */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-xs sm:text-sm font-bold text-[#24263e] hover:border-[#c34c36] hover:text-[#c34c36] transition cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#24263e]/8 text-[#24263e] text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-[#c34c36]" />
            <span>Trung tâm Pháp lý SecondLife</span>
          </div>
        </div>

        {/* Official Single-Source Policy Content */}
        <PolicyDocumentView />
      </div>
    </div>
  );
};
