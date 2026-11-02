import React, { useMemo } from 'react';
import { AlertOctagon, AlertTriangle, ShieldAlert, Award, TrendingDown } from 'lucide-react';
import { InspectionOrderDto } from '../../services/inspectorService';

interface InspectionPenaltyPreviewCardProps {
  order: InspectionOrderDto;
  currentReputationScore?: number;
  className?: string;
}

interface PenaltyCalculationResult {
  penaltyPoints: number;
  isSerious: boolean;
  reason: string;
  failedCount: number;
  totalCount: number;
  failureRate: number;
}

export const InspectionPenaltyPreviewCard: React.FC<InspectionPenaltyPreviewCardProps> = ({
  order,
  currentReputationScore = 100,
  className = '',
}) => {
  const calculation = useMemo<PenaltyCalculationResult>(() => {
    const score = order.conditionScore;
    const grade = order.conditionGrade;
    const isPoor = (grade && grade.toUpperCase() === 'POOR') || (score !== undefined && score !== null && score < 40);

    if (isPoor) {
      return {
        penaltyPoints: 40,
        isSerious: true,
        reason: 'Sản phẩm xếp hạng KÉM (POOR) hoặc điểm chất lượng < 40 (Vi phạm nghiêm trọng mô tả sản phẩm)',
        failedCount: 0,
        totalCount: 0,
        failureRate: 1,
      };
    }

    if (order.checklistResultJson) {
      try {
        const items = JSON.parse(order.checklistResultJson);
        if (Array.isArray(items) && items.length > 0) {
          const total = items.length;
          const failed = items.filter((it: any) => it.passed === false || it.isPassed === false).length;
          const failureRate = failed / total;

          if (failureRate > 0.6) {
            return {
              penaltyPoints: 40,
              isSerious: true,
              reason: `Có ${failed}/${total} tiêu chí kiểm định bị đánh rớt (${Math.round(failureRate * 100)}% không đạt chuẩn)`,
              failedCount: failed,
              totalCount: total,
              failureRate,
            };
          } else if (failureRate > 0.3) {
            return {
              penaltyPoints: 20,
              isSerious: false,
              reason: `Có ${failed}/${total} tiêu chí kiểm định bị đánh rớt (${Math.round(failureRate * 100)}% sai lệch so với tin đăng)`,
              failedCount: failed,
              totalCount: total,
              failureRate,
            };
          } else {
            return {
              penaltyPoints: 10,
              isSerious: false,
              reason: `Có ${failed}/${total} tiêu chí kiểm định bị đánh rớt (${Math.round(failureRate * 100)}% hao mòn thực tế)`,
              failedCount: failed,
              totalCount: total,
              failureRate,
            };
          }
        }
      } catch (e) {
        // Fallback below
      }
    }

    return {
      penaltyPoints: 15,
      isSerious: false,
      reason: 'Sản phẩm kiểm định KHÔNG ĐẠT (Mức phạt chuẩn của hệ thống)',
      failedCount: 0,
      totalCount: 0,
      failureRate: 0,
    };
  }, [order]);

  const newEstimatedScore = Math.max(0, currentReputationScore - calculation.penaltyPoints);

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-all ${
        calculation.isSerious
          ? 'border-red-300 bg-red-50/70 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
          : 'border-amber-300 bg-amber-50/70 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-xl flex-shrink-0 ${
            calculation.isSerious
              ? 'bg-red-200/80 text-red-800 dark:bg-red-900/60 dark:text-red-300'
              : 'bg-amber-200/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
          }`}
        >
          {calculation.isSerious ? (
            <AlertOctagon className="w-6 h-6" />
          ) : (
            <ShieldAlert className="w-6 h-6" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-semibold text-base sm:text-lg flex items-center gap-1.5">
              <span>Mức trừ điểm uy tín dự tính:</span>
              <span
                className={`inline-flex items-center font-bold px-2.5 py-0.5 rounded-lg text-sm sm:text-base ${
                  calculation.isSerious
                    ? 'bg-red-600 text-white dark:bg-red-500'
                    : 'bg-amber-600 text-white dark:bg-amber-500'
                }`}
              >
                -{calculation.penaltyPoints} Điểm
              </span>
            </h4>

            {calculation.isSerious && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-800">
                <AlertTriangle className="w-3 h-3" /> Vi phạm nghiêm trọng
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm mt-1.5 opacity-90 leading-relaxed">
            {calculation.reason}
          </p>

          <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Award className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span>Điểm uy tín hiện tại:</span>
              <span className="font-bold">{currentReputationScore}</span>
            </div>

            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400" />
              <span>Sau khi áp dụng:</span>
              <span
                className={`font-bold ${
                  newEstimatedScore < 50
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {newEstimatedScore} / 100
              </span>
            </div>
          </div>

          {newEstimatedScore < 50 && (
            <div className="mt-3 p-2.5 rounded-lg bg-red-100/90 dark:bg-red-900/40 border border-red-300 dark:border-red-800 text-xs text-red-800 dark:text-red-300 font-medium">
              Cảnh báo: Điểm uy tín dưới 50 sẽ hạn chế quyền đăng tin bán hàng và bị gắn cờ cảnh báo trên trang cá nhân.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

