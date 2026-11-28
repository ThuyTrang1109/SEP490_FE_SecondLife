import { CheckCircle2, FileCheck, Printer, ShieldCheck } from 'lucide-react';
import type { EscrowOrder } from '../../../types';

interface Props {
  order: EscrowOrder;
  setVerifySealId: (id: string) => void;
  setIsVerifySealModalOpen: (open: boolean) => void;
  setPrintSealOrder: (order: EscrowOrder) => void;
}

export function OrderDetailCertificate({
  order: detailModalOrder,
  setVerifySealId,
  setIsVerifySealModalOpen,
  setPrintSealOrder,
}: Props) {
  return (
    <>
      {/* Inspection Certificate & Tamper Seal Section */}
      {detailModalOrder.inspectionReport && (
        <div className="rounded-2xl bg-[#faf8f5] p-5 border border-gray-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#24263e] text-white flex items-center justify-center">
                <FileCheck className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#24263e]">
                  Biên bản giám định xác thực #{detailModalOrder.inspectionReport.id}
                </h4>
                <p className="text-xs text-[#24263e]/70">
                  {detailModalOrder.inspectionReport.centerName} • {detailModalOrder.inspectionReport.inspectorName}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-[#24263e] text-white">
                {detailModalOrder.inspectionReport.verdict === 'PASS' ? 'KẾT QUẢ: ĐẠT CHUẨN' : 'KHÔNG ĐẠT'}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#FFFFFF] text-[#24263e] border border-gray-200">
                Mã tem: {detailModalOrder.inspectionReport.tamperSealId}
              </span>
              <button
                type="button"
                onClick={() => {
                  setVerifySealId(detailModalOrder.inspectionReport?.tamperSealId || '');
                  setIsVerifySealModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition cursor-pointer shadow-xs"
                title="Quét và tra cứu chứng thực tem từ Backend SecondLife"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Xác thực tem (BE)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintSealOrder(detailModalOrder)}
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#c34c36] hover:bg-[#a83b27] text-white flex items-center gap-1 transition cursor-pointer shadow-xs"
                title="Tạo mã in tem niêm phong chuẩn"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Tem QR</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-[#24263e] bg-[#FFFFFF] p-3 rounded-xl border border-gray-200 italic">
            "{detailModalOrder.inspectionReport.summaryNotes}"
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {(detailModalOrder.inspectionReport.checklistResults || []).map((chk) => (
              <div key={chk.id} className="flex items-start gap-2 bg-[#FFFFFF] p-2.5 rounded-lg border border-gray-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="break-words leading-snug">
                  <span className="font-semibold text-[#24263e]">{chk.category}: </span>
                  <span className="text-[#24263e]/80">{chk.testedValue || 'Đạt'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
