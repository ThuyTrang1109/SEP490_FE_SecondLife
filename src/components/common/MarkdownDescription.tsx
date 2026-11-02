import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Columns2,
  Eye,
  FileCode2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  PenLine,
  Quote
} from 'lucide-react';

export const hasMarkdownSyntax = (text?: string): boolean => {
  if (!text) return false;
  return /(\*\*[^*\n]+\*\*|__[^_\n]+__|^#{1,4}\s+\S|^\s*[-*+]\s+\S|^\s*\d+[.)]\s+\S|^>\s+\S|```)/m.test(
    text
  );
};

/**
 * Phân tích cú pháp inline Markdown an toàn (thuần React JSX, chống XSS 100%):
 * Hỗ trợ: ***bold-italic***, **bold**, __bold__, *italic*, _italic_, ~~strike~~, `code`, [label](https://...)
 */
function renderInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  if (!text) return [];

  const tokenRegex =
    /(\*\*\*([^\n*]+?)\*\*\*|\*\*([^\n*]+?)\*\*|__([^\n_]+?)__|~~([^\n~]+?)~~|`([^`\n]+?)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(?<!\w)\*([^\s*](?:[^\n*]*?[^\s*])?)\*(?!\w)|(?<!\w)_([^\s_](?:[^\n_]*?[^\s_])?)_(?!\w))/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-in-${partIdx++}`;
    if (match[2] !== undefined) {
      nodes.push(
        <strong key={key} className="font-bold italic text-[#24263e]">
          {match[2]}
        </strong>
      );
    } else if (match[3] !== undefined || match[4] !== undefined) {
      const content = match[3] ?? match[4];
      nodes.push(
        <strong key={key} className="font-bold text-[#24263e]">
          {content}
        </strong>
      );
    } else if (match[5] !== undefined) {
      nodes.push(
        <del key={key} className="line-through text-slate-400">
          {match[5]}
        </del>
      );
    } else if (match[6] !== undefined) {
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 font-mono text-[11px] text-[#c34c36]"
        >
          {match[6]}
        </code>
      );
    } else if (match[7] !== undefined && match[8] !== undefined) {
      nodes.push(
        <a
          key={key}
          href={match[8]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline font-semibold break-all"
        >
          {match[7]}
        </a>
      );
    } else if (match[9] !== undefined || match[10] !== undefined) {
      const content = match[9] ?? match[10];
      nodes.push(
        <em key={key} className="italic text-slate-700">
          {content}
        </em>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export interface MarkdownContentProps {
  content?: string | null;
  className?: string;
  emptyText?: string;
}

/**
 * Hiển thị nội dung mô tả định dạng Markdown (.md) chuẩn sàn TMĐT SecondLife
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  className = '',
  emptyText = 'Chưa có nội dung mô tả.'
}) => {
  const normalized = (content || '').replace(/\r\n/g, '\n').trim();

  if (!normalized) {
    return <p className="text-xs text-slate-400 italic">{emptyText}</p>;
  }

  const lines = normalized.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Dòng trống
    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block ```
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push(
        <pre
          key={`blk-${blockKey++}`}
          className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed my-2"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Đường kẻ ngang --- / ***
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`blk-${blockKey++}`} className="my-2.5 border-slate-200" />);
      i++;
      continue;
    }

    // Heading # .. ####
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      const sizeCls =
        level === 1
          ? 'text-sm font-black text-[#24263e] mt-2.5 mb-1'
          : level === 2
          ? 'text-[13px] font-black text-[#24263e] mt-2.5 mb-1'
          : 'text-xs font-extrabold text-[#24263e] mt-2 mb-0.5';
      blocks.push(
        <div key={`blk-${blockKey++}`} className={sizeCls}>
          {renderInlineMarkdown(headingText, `h-${blockKey}`)}
        </div>
      );
      i++;
      continue;
    }

    // Dòng tiêu đề mục in đậm nguyên dòng (VD: **🌟 Tình trạng sản phẩm:**)
    const standaloneBoldMatch = trimmed.match(/^\*\*([^*\n]+)\*\*:?\s*$/);
    if (standaloneBoldMatch) {
      const sectionLabel = trimmed.replace(/\*\*/g, '').trim();
      blocks.push(
        <div
          key={`blk-${blockKey++}`}
          className="text-xs font-extrabold text-[#24263e] pt-1.5 pb-0.5 flex items-center gap-1.5"
        >
          <span>{sectionLabel}</span>
        </div>
      );
      i++;
      continue;
    }

    // Blockquote > ...
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`blk-${blockKey++}`}
          className="border-l-3 border-[#c34c36]/70 bg-amber-50/50 pl-3 pr-2.5 py-1.5 rounded-r-lg text-xs text-slate-700 italic space-y-1 my-1.5"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{renderInlineMarkdown(ql, `q-${blockKey}-${qIdx}`)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Danh sách không thứ tự (* , - , + , • )
    if (/^\s*(?:[-*+•])\s+\S/.test(rawLine)) {
      const items: Array<{ text: string; nested: boolean }> = [];
      while (i < lines.length && /^\s*(?:[-*+•])\s+\S/.test(lines[i])) {
        const leadingSpaces = (lines[i].match(/^(\s*)/)?.[1] || '').length;
        const itemText = lines[i].replace(/^\s*(?:[-*+•])\s+/, '').trim();
        items.push({ text: itemText, nested: leadingSpaces >= 2 });
        i++;
      }
      const listKey = blockKey++;
      blocks.push(
        <ul key={`blk-${listKey}`} className="space-y-1.5 my-1">
          {items.map((item, idx) => (
            <li
              key={idx}
              className={`flex items-start gap-2 text-xs text-slate-700 leading-relaxed ${
                item.nested ? 'pl-4' : ''
              }`}
            >
              <span
                className={`mt-1.5 rounded-full shrink-0 ${
                  item.nested
                    ? 'w-1.5 h-1.5 border border-slate-400 bg-transparent'
                    : 'w-1.5 h-1.5 bg-[#c34c36]/85'
                }`}
              />
              <span className="flex-1 min-w-0">
                {renderInlineMarkdown(item.text, `ul-${listKey}-${idx}`)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Danh sách có thứ tự (1. , 2) )
    if (/^\s*\d+[.)]\s+\S/.test(rawLine)) {
      const items: Array<{ num: string; text: string }> = [];
      while (i < lines.length && /^\s*\d+[.)]\s+\S/.test(lines[i])) {
        const m = lines[i].match(/^\s*(\d+)[.)]\s+(.+)$/);
        if (m) {
          items.push({ num: m[1], text: m[2].trim() });
        }
        i++;
      }
      const listKey = blockKey++;
      blocks.push(
        <ol key={`blk-${listKey}`} className="space-y-1.5 my-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
              <span className="font-bold text-[#24263e] shrink-0 min-w-[16px]">{item.num}.</span>
              <span className="flex-1 min-w-0">
                {renderInlineMarkdown(item.text, `ol-${listKey}-${idx}`)}
              </span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Bảng Markdown đơn giản | A | B |
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length >= 3) {
      const tableRows: string[][] = [];
      while (
        i < lines.length &&
        lines[i].trim().startsWith('|') &&
        lines[i].trim().endsWith('|')
      ) {
        const rowStr = lines[i].trim();
        // Bỏ qua dòng phân cách |---|---|
        if (!/^\|[\s:-]+\|/.test(rowStr) || /[a-zA-Z0-9À-ỹ]/.test(rowStr)) {
          const cells = rowStr
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
          tableRows.push(cells);
        }
        i++;
      }
      if (tableRows.length > 0) {
        const tblKey = blockKey++;
        const [header, ...body] = tableRows;
        blocks.push(
          <div key={`blk-${tblKey}`} className="overflow-x-auto my-2 rounded-lg border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-[#24263e] font-bold">
                <tr>
                  {header.map((cell, cIdx) => (
                    <th key={cIdx} className="px-2.5 py-1.5 border-b border-slate-200">
                      {renderInlineMarkdown(cell, `th-${tblKey}-${cIdx}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              {body.length > 0 && (
                <tbody className="divide-y divide-slate-100 bg-white">
                  {body.map((r, rIdx) => (
                    <tr key={rIdx}>
                      {r.map((cell, cIdx) => (
                        <td key={cIdx} className="px-2.5 py-1.5 text-slate-700">
                          {renderInlineMarkdown(cell, `td-${tblKey}-${rIdx}-${cIdx}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        );
        continue;
      }
    }

    // Đoạn văn thông thường (gom các dòng văn bản liên tiếp)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^(?:-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^\*\*([^*\n]+)\*\*:?\s*$/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*(?:[-*+•])\s+\S/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+\S/.test(lines[i])
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }

    const pKey = blockKey++;
    blocks.push(
      <p key={`blk-${pKey}`} className="text-xs text-slate-700 leading-relaxed">
        {paraLines.map((pl, pIdx) => (
          <React.Fragment key={pIdx}>
            {pIdx > 0 && <br />}
            {renderInlineMarkdown(pl, `p-${pKey}-${pIdx}`)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className={`space-y-2 ${className}`}>{blocks}</div>;
};

type EditorViewMode = 'edit' | 'preview' | 'split';

export interface MarkdownDescriptionEditorProps {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  hasError?: boolean;
  rows?: number;
  maxLength?: number;
}

/**
 * Ô nhập & xem hiển thị Markdown (.md) dành cho Mô tả chi tiết sản phẩm
 */
export const MarkdownDescriptionEditor: React.FC<MarkdownDescriptionEditorProps> = ({
  id = 'description-input',
  value,
  onChange,
  placeholder,
  hasError = false,
  rows = 7,
  maxLength = 10000
}) => {
  const [viewMode, setViewMode] = useState<EditorViewMode>(() =>
    hasMarkdownSyntax(value) ? 'preview' : 'edit'
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isTypingRef = useRef<boolean>(false);
  const lastExternalValueRef = useRef<string>(value);

  // Tự động chuyển sang chế độ Xem hiển thị khi AI điền mô tả có Markdown (và người dùng không đang gõ trực tiếp)
  useEffect(() => {
    if (hasError && (!value || value.trim().length < 10)) {
      setViewMode('edit');
      return;
    }
    if (!isTypingRef.current && value !== lastExternalValueRef.current) {
      lastExternalValueRef.current = value;
      if (hasMarkdownSyntax(value)) {
        setViewMode('preview');
      } else if (!value.trim()) {
        setViewMode('edit');
      }
    }
  }, [value, hasError]);

  const applyWrapSyntax = (prefix: string, suffix: string, sampleText: string) => {
    const el = textareaRef.current;
    if (!el) {
      setViewMode('edit');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const insertBody = selected || sampleText;
    const nextValue =
      value.slice(0, start) + prefix + insertBody + suffix + value.slice(end);

    isTypingRef.current = true;
    lastExternalValueRef.current = nextValue;
    onChange(nextValue.slice(0, maxLength));

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      const selStart = start + prefix.length;
      const selEnd = selStart + insertBody.length;
      textareaRef.current.setSelectionRange(selStart, selEnd);
    });
  };

  const applyLinePrefix = (linePrefix: string, sampleText: string) => {
    const el = textareaRef.current;
    if (!el) {
      setViewMode('edit');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const needsLeadingNewline = start > 0 && value[start - 1] !== '\n';
    const lead = needsLeadingNewline ? '\n' : '';

    const formatted = selected
      ? selected
          .split('\n')
          .map((line) => (line.trim() ? `${linePrefix}${line}` : line))
          .join('\n')
      : `${linePrefix}${sampleText}`;

    const nextValue = value.slice(0, start) + lead + formatted + value.slice(end);
    isTypingRef.current = true;
    lastExternalValueRef.current = nextValue;
    onChange(nextValue.slice(0, maxLength));

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      const cursorPos = start + lead.length + formatted.length;
      textareaRef.current.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const switchToEditAndFocus = () => {
    setViewMode('edit');
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  return (
    <div
      id="description-field-container"
      className={`rounded-xl border overflow-hidden transition bg-slate-50 ${
        hasError
          ? 'border-rose-400 bg-rose-50/20 focus-within:border-rose-500'
          : 'border-gray-200 focus-within:border-[#c34c36]'
      }`}
    >
      {/* Thanh công cụ Markdown & chuyển chế độ */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-white border-b border-gray-200/80">
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
              viewMode === 'edit'
                ? 'bg-white text-[#24263e] shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PenLine className="w-3 h-3" />
            <span>Soạn thảo (.md)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
              viewMode === 'preview'
                ? 'bg-white text-[#c34c36] shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Xem hiển thị</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`hidden md:flex px-2.5 py-1 rounded-md text-[11px] font-bold items-center gap-1 transition cursor-pointer ${
              viewMode === 'split'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Soạn thảo và xem trước Markdown song song"
          >
            <Columns2 className="w-3 h-3" />
            <span>Song song</span>
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {viewMode !== 'preview' ? (
            <>
              <button
                type="button"
                onClick={() => applyWrapSyntax('**', '**', 'chữ in đậm')}
                className="p-1.5 rounded-md text-slate-600 hover:text-[#24263e] hover:bg-slate-100 transition cursor-pointer"
                title="In đậm (**text**)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyWrapSyntax('*', '*', 'chữ in nghiêng')}
                className="p-1.5 rounded-md text-slate-600 hover:text-[#24263e] hover:bg-slate-100 transition cursor-pointer"
                title="In nghiêng (*text*)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyLinePrefix('### ', 'Tiêu đề mục')}
                className="p-1.5 rounded-md text-slate-600 hover:text-[#24263e] hover:bg-slate-100 transition cursor-pointer"
                title="Tiêu đề mục (### )"
              >
                <Heading3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyLinePrefix('* ', 'Ý mô tả sản phẩm')}
                className="p-1.5 rounded-md text-slate-600 hover:text-[#24263e] hover:bg-slate-100 transition cursor-pointer"
                title="Gạch đầu dòng (* )"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyLinePrefix('1. ', 'Điểm nổi bật')}
                className="p-1.5 rounded-md text-slate-600 hover:text-[#24263e] hover:bg-slate-100 transition cursor-pointer"
                title="Danh sách đánh số (1. )"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyLinePrefix('> ', 'Lưu ý cho người mua')}
                className="p-1.5 rounded-md text-slate-600 hover:text-[#24263e] hover:bg-slate-100 transition cursor-pointer"
                title="Ghi chú nổi bật (> )"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={switchToEditAndFocus}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-600 hover:text-[#24263e] bg-slate-100 hover:bg-slate-200/80 transition cursor-pointer flex items-center gap-1"
            >
              <PenLine className="w-3 h-3" />
              <span>Bấm để chỉnh sửa nội dung</span>
            </button>
          )}
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 pl-1.5 border-l border-gray-200">
            <FileCode2 className="w-3 h-3" />
            <span>.md</span>
          </span>
        </div>
      </div>

      {/* Vùng nội dung: Edit / Preview / Split */}
      {viewMode === 'edit' && (
        <textarea
          ref={textareaRef}
          id={id}
          rows={rows}
          maxLength={maxLength}
          value={value}
          onFocus={() => {
            isTypingRef.current = true;
          }}
          onBlur={() => {
            isTypingRef.current = false;
          }}
          onChange={(e) => {
            isTypingRef.current = true;
            lastExternalValueRef.current = e.target.value;
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className={`w-full px-4 py-3 bg-transparent text-xs leading-relaxed focus:outline-none resize-y ${
            hasError ? 'text-rose-700' : 'text-slate-800'
          }`}
        />
      )}

      {viewMode === 'preview' && (
        <div
          onDoubleClick={switchToEditAndFocus}
          title="Nhấp đúp hoặc bấm 'Soạn thảo (.md)' để chỉnh sửa"
          className="px-4 py-3.5 bg-white/80 min-h-[168px] max-h-[360px] overflow-y-auto subtle-scrollbar"
        >
          <MarkdownContent
            content={value}
            emptyText="Chưa có nội dung mô tả. Chuyển sang tab 'Soạn thảo (.md)' để nhập hoặc tạo bằng AI."
          />
        </div>
      )}

      {viewMode === 'split' && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          <textarea
            ref={textareaRef}
            id={id}
            rows={rows + 1}
            maxLength={maxLength}
            value={value}
            onFocus={() => {
              isTypingRef.current = true;
            }}
            onBlur={() => {
              isTypingRef.current = false;
            }}
            onChange={(e) => {
              isTypingRef.current = true;
              lastExternalValueRef.current = e.target.value;
              onChange(e.target.value);
            }}
            placeholder={placeholder}
            className={`w-full px-3.5 py-3 bg-transparent text-xs font-mono leading-relaxed focus:outline-none resize-y ${
              hasError ? 'text-rose-700' : 'text-slate-800'
            }`}
          />
          <div className="px-4 py-3 bg-white/90 min-h-[168px] max-h-[360px] overflow-y-auto subtle-scrollbar">
            <MarkdownContent
              content={value}
              emptyText="Xem trước định dạng Markdown sẽ hiển thị trực tiếp tại đây..."
            />
          </div>
        </div>
      )}
    </div>
  );
};

