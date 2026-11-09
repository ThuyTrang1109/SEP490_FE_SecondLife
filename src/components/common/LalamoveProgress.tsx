import { Check, Package } from 'lucide-react';

const shipmentSteps = [
  { title: 'Tạo vận đơn', desc: 'Đang điều phối tài xế Lalamove' },
  { title: 'Tài xế nhận đơn', desc: 'Tài xế đang di chuyển tới lấy hàng' },
  { title: 'Đã lấy kiện', desc: 'Tài xế đã nhận hàng & đang giao' },
  { title: 'Đã giao thành công', desc: 'Kiện hàng đã bàn giao tới người nhận' },
];

interface LalamoveProgressProps {
  currentStep: number | null;
  completeCurrentStep?: boolean;
  finalStep?: { title: string; desc: string };
}

export function LalamoveProgress({ currentStep, completeCurrentStep, finalStep }: LalamoveProgressProps) {
  const steps = finalStep ? [...shipmentSteps, finalStep] : shipmentSteps;

  return (
    <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5">
      <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500">
        <Package className="h-4 w-4 text-orange-600" />
        Tiến trình vận chuyển Lalamove
      </h4>

      <ol className={`relative gap-2 pl-6 sm:grid sm:pl-0 ${finalStep ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
        {steps.map((step, index) => {
          const isCurrent = currentStep === index;
          const isDone = currentStep !== null && (currentStep > index || (isCurrent && completeCurrentStep));
          return (
            <li
              key={step.title}
              aria-current={isCurrent && !isDone ? 'step' : undefined}
              className="relative flex items-start pb-6 sm:flex-col sm:items-center sm:pb-0 sm:text-center"
            >
              {index < steps.length - 1 && (
                <div aria-hidden="true" className={`absolute left-1/2 top-4 hidden h-1 w-[calc(100%+0.5rem)] transition-colors sm:block ${isDone ? 'bg-emerald-500' : 'bg-gray-200'}`} />
              )}
              <div aria-hidden="true" className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                isDone
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : isCurrent
                    ? 'bg-orange-600 text-white ring-4 ring-orange-500/20 shadow-md motion-safe:animate-pulse'
                    : 'border border-gray-300 bg-gray-100 text-gray-400'
              }`}>
                {isDone ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <div className="ml-3 sm:ml-0 sm:mt-2.5">
                <span className={`block text-xs font-extrabold ${isCurrent ? 'text-orange-600' : isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                  {step.title}
                </span>
                <span className="mt-0.5 hidden text-[10px] leading-snug text-slate-500 sm:block">{step.desc}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
