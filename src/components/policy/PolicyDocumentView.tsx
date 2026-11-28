import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Calendar,
  ShieldCheck,
  List,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { PolicyVersionDto, policyService } from '../../services/policyService';

interface PolicyDocumentViewProps {
  policy?: PolicyVersionDto | null;
  compact?: boolean;
  onPolicyLoaded?: (policy: PolicyVersionDto) => void;
}

interface TocItem {
  id: string;
  title: string;
}

type MarkdownBlock =
  | { type: 'h1' | 'h2' | 'h3'; id: string; text: string }
  | { type: 'hr' }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; alignments: ('left' | 'center' | 'right')[]; rows: string[][] }
  | { type: 'p'; text: string };

function slugifyHeading(text: string, index: number): string {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized ? `sec-${index}-${normalized.slice(0, 48)}` : `sec-${index}`;
}

function parseTableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const cells = parseTableCells(trimmed);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function parseAlignments(line: string): ('left' | 'center' | 'right')[] {
  return parseTableCells(line).map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
    if (cell.endsWith(':')) return 'right';
    return 'left';
  });
}

function parseMarkdown(markdown: string): { blocks: MarkdownBlock[]; toc: TocItem[] } {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  const toc: TocItem[] = [];
  let headingIdx = 0;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i++;
      continue;
    }

    if (/^-{3,}$/.test(line) || /^\*{3,}$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    const hMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2].trim();
      headingIdx++;
      const id = slugifyHeading(text, headingIdx);
      const type = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      blocks.push({ type, id, text });
      if (type === 'h2') {
        toc.push({ id, title: text });
      }
      i++;
      continue;
    }

    // Markdown Table
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableCells(line);
      const alignments = parseAlignments(lines[i + 1]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(parseTableCells(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', headers, alignments, rows });
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraph (join consecutive non-special lines)
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        /^#{1,3}\s+/.test(next) ||
        /^-{3,}$/.test(next) ||
        /^[-*•]\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        (next.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(next);
      i++;
    }
    blocks.push({ type: 'p', text: paraLines.join(' ') });
  }

  return { blocks, toc };
}

/**
 * XSS-safe inline formatter supporting **bold**, *italic*, and `inline code`.
 * Never uses dangerouslySetInnerHTML.
 */
function renderInlineText(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-bold text-[#24263e]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-[#24263e]/8 text-[#24263e] text-[0.9em] font-semibold font-mono"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={key++} className="italic text-[#24263e]/85">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function formatViDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Chờ công bố ngày hiệu lực chính thức';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Chờ công bố ngày hiệu lực chính thức';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export const PolicyDocumentView: React.FC<PolicyDocumentViewProps> = ({
  policy: externalPolicy,
  compact = false,
  onPolicyLoaded,
}) => {
  const [policy, setPolicy] = useState<PolicyVersionDto | null>(externalPolicy ?? null);
  const [loading, setLoading] = useState(!externalPolicy);
  const [error, setError] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(!compact);
  const [activeSection, setActiveSection] = useState<string>('');

  const loadPolicy = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await policyService.getCurrentPolicy(force);
      setPolicy(data);
      onPolicyLoaded?.(data);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải nội dung Điều khoản sử dụng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (externalPolicy) {
      setPolicy(externalPolicy);
      setLoading(false);
      setError(null);
    } else {
      loadPolicy(false);
    }
  }, [externalPolicy?.id]);

  const parsed = useMemo(() => {
    if (!policy?.contentMarkdown) return { blocks: [], toc: [] };
    return parseMarkdown(policy.contentMarkdown);
  }, [policy?.contentMarkdown]);

  const scrollToHeading = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (compact) {
      setTocOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 py-8 text-center">
        <div className="w-8 h-8 border-2 border-[#c34c36] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-[#24263e]/70">
          Đang tải nội dung Điều khoản sử dụng và Quy chế hoạt động...
        </p>
      </div>
    );
  }

  if (error || !policy) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
        <p className="text-sm font-bold text-rose-900">
          {error || 'Chưa có phiên bản chính sách đang áp dụng.'}
        </p>
        <button
          type="button"
          onClick={() => loadPolicy(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#24263e] text-white text-xs font-bold hover:bg-[#36395c] transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Tải lại chính sách</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Document Metadata Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#24263e]/15 shadow-xs space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c34c36]/15 border border-[#c34c36]/30 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#c34c36]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#24263e] leading-snug">
                {policy.title}
              </h2>
              <p className="text-xs text-[#24263e]/70 font-medium mt-0.5">
                Tài liệu chính thức áp dụng thống nhất trên Website và Ứng dụng di động SecondLife
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#24263e] text-white text-xs font-black tracking-wide shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-[#fce5da]" />
            <span>Phiên bản {policy.version}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs text-[#24263e]/80">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
            <span>
              <strong>Ngày công bố / cập nhật:</strong> {formatViDateTime(policy.publishedAt || policy.updatedAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
            <span>
              <strong>Ngày có hiệu lực:</strong> {formatViDateTime(policy.effectiveAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Layout: Sticky TOC on Desktop full page, collapsible accordion in compact/mobile */}
      <div className={compact ? 'space-y-4' : 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'}>
        {parsed.toc.length > 0 && (
          <nav
            aria-label="Mục lục điều khoản"
            className={
              compact
                ? 'rounded-2xl bg-white border border-gray-200 overflow-hidden'
                : 'lg:col-span-4 lg:sticky lg:top-24 rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-xs'
            }
          >
            <button
              type="button"
              onClick={() => setTocOpen((v) => !v)}
              aria-expanded={tocOpen}
              className="w-full px-4 py-3 flex items-center justify-between text-left bg-[#24263e] text-white font-black text-xs uppercase tracking-wider cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <List className="w-4 h-4 text-[#fce5da]" />
                <span>Mục lục ({parsed.toc.length} điều khoản)</span>
              </span>
              {tocOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {tocOpen && (
              <ul className="divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
                {parsed.toc.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToHeading(item.id)}
                      className={`w-full px-4 py-2.5 text-left text-xs font-semibold transition cursor-pointer hover:bg-[#faf8f5] ${
                        activeSection === item.id
                          ? 'bg-[#fce5da]/40 text-[#c34c36] font-extrabold border-l-3 border-[#c34c36]'
                          : 'text-[#24263e]/85'
                      }`}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        )}

        {/* Policy Body */}
        <article
          className={
            compact
              ? 'space-y-4 bg-white rounded-2xl border border-gray-200 p-4 sm:p-6'
              : 'lg:col-span-8 space-y-4 bg-white rounded-2xl border border-gray-200 p-5 sm:p-8 shadow-xs'
          }
        >
          {parsed.blocks.map((block, idx) => {
            switch (block.type) {
              case 'h1':
                return (
                  <h1
                    key={idx}
                    id={block.id}
                    className="text-lg sm:text-xl font-black text-[#24263e] tracking-tight scroll-mt-24"
                  >
                    {renderInlineText(block.text)}
                  </h1>
                );
              case 'h2':
                return (
                  <h2
                    key={idx}
                    id={block.id}
                    className="text-base sm:text-lg font-black text-[#24263e] pt-4 pb-2 border-b border-[#c34c36]/25 scroll-mt-24"
                  >
                    {renderInlineText(block.text)}
                  </h2>
                );
              case 'h3':
                return (
                  <h3
                    key={idx}
                    id={block.id}
                    className="text-sm sm:text-base font-extrabold text-[#24263e] pt-2 scroll-mt-24"
                  >
                    {renderInlineText(block.text)}
                  </h3>
                );
              case 'hr':
                return <hr key={idx} className="border-gray-200 my-3" />;
              case 'p':
                return (
                  <p key={idx} className="text-xs sm:text-sm text-[#24263e]/85 leading-relaxed">
                    {renderInlineText(block.text)}
                  </p>
                );
              case 'ul':
                return (
                  <ul key={idx} className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#24263e]/85 leading-relaxed">
                    {block.items.map((item, li) => (
                      <li key={li}>{renderInlineText(item)}</li>
                    ))}
                  </ul>
                );
              case 'ol':
                return (
                  <ol key={idx} className="list-decimal pl-5 space-y-1.5 text-xs sm:text-sm text-[#24263e]/85 leading-relaxed">
                    {block.items.map((item, li) => (
                      <li key={li}>{renderInlineText(item)}</li>
                    ))}
                  </ol>
                );
              case 'table':
                return (
                  <div key={idx} className="overflow-x-auto rounded-xl border border-gray-200 my-3">
                    <table className="w-full min-w-[460px] text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#24263e] text-white">
                          {block.headers.map((h, hi) => (
                            <th
                              key={hi}
                              className={`px-3.5 py-2.5 font-extrabold border-b border-white/15 ${
                                block.alignments[hi] === 'center'
                                  ? 'text-center'
                                  : block.alignments[hi] === 'right'
                                  ? 'text-right'
                                  : 'text-left'
                              }`}
                            >
                              {renderInlineText(h)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {block.rows.map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 1 ? 'bg-[#faf8f5]' : 'bg-white'}>
                            {row.map((cell, ci) => (
                              <td
                                key={ci}
                                className={`px-3.5 py-2.5 text-[#24263e]/90 ${
                                  block.alignments[ci] === 'center'
                                    ? 'text-center'
                                    : block.alignments[ci] === 'right'
                                    ? 'text-right'
                                    : 'text-left'
                                }`}
                              >
                                {renderInlineText(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
            }
          })}
        </article>
      </div>
    </div>
  );
};
