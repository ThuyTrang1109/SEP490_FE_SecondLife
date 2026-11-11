import { useRef } from 'react';
import { GripVertical, Menu } from 'lucide-react';

interface ResizableSidebarControlsProps {
  width: number;
  collapsed: boolean;
  onResize: (width: number) => void;
  onToggle: () => void;
  lang?: 'vi' | 'en';
}

const minWidth = 208;
const maxWidth = 384;

export function ResizableSidebarControls({ width, collapsed, onResize, onToggle, lang = 'vi' }: ResizableSidebarControlsProps) {
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const resize = (next: number) => onResize(Math.min(maxWidth, Math.max(minWidth, next)));
  const toggleLabel = lang === 'vi'
    ? (collapsed ? 'Mở rộng menu' : 'Thu gọn menu')
    : (collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  const resizeLabel = lang === 'vi' ? 'Điều chỉnh chiều rộng menu' : 'Resize sidebar';

  return (
    <>
      <button type="button" aria-label={toggleLabel} aria-expanded={!collapsed} title={toggleLabel} onClick={onToggle}
        className={`hidden h-8 w-8 items-center justify-center rounded-lg text-[#24263e] hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-[#c34c36] md:inline-flex ${collapsed ? 'mx-auto mt-2 shrink-0' : 'absolute top-4 right-2'}`}>
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>
      {!collapsed && (
        <div role="separator" tabIndex={0} aria-orientation="vertical" aria-label={resizeLabel} title={resizeLabel}
          aria-valuemin={minWidth} aria-valuemax={maxWidth} aria-valuenow={width}
          className="group absolute inset-y-0 -right-1.5 z-10 hidden w-3 touch-none cursor-col-resize items-center justify-center outline-none hover:bg-[#c34c36]/10 focus-visible:bg-[#c34c36]/20 md:flex"
          onPointerDown={(event) => {
            if (event.button !== 0 || drag.current) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { pointerId: event.pointerId, x: event.clientX, width };
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (start?.pointerId === event.pointerId) resize(start.width + event.clientX - start.x);
          }}
          onLostPointerCapture={(event) => {
            if (drag.current?.pointerId === event.pointerId) drag.current = null;
          }}
          onKeyDown={(event) => {
            const next = { ArrowLeft: width - 16, ArrowRight: width + 16, Home: minWidth, End: maxWidth }[event.key];
            if (next === undefined) return;
            event.preventDefault();
            resize(next);
          }}>
          <GripVertical className="h-7 w-3 shrink-0 rounded-full bg-[#fce5da] text-[#915044] shadow-sm group-hover:text-[#c34c36]" aria-hidden="true" />
        </div>
      )}
    </>
  );
}
