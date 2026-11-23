import { useState } from 'react';
import {
  Archive,
  Award,
  Check,
  Copy,
  ExternalLink,
  FileCheck,
  FileText,
  FolderSync,
  Lock,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  ModuleBackBar,
  SkeletonCardList,
  SkeletonTableCard,
  StatusBadge,
  useIsMobileViewport,
  useToast,
} from '@/shared/ui';
import { type DocumentRecordRow, useDocumentRecordsQuery } from './data/documentQueries';

const DOCUMENT_CATEGORIES = [
  { value: 'all', label: 'All Documents', icon: FileText },
  { value: 'roster_pdf', label: 'Roster Schedules', icon: FileCheck },
  { value: 'course_certificate', label: 'Certifications', icon: Award },
  { value: 'apc', label: 'Annual Practicing Certs', icon: ShieldCheck },
  { value: 'policy', label: 'Department Policies', icon: FolderSync },
  { value: 'archive', label: 'Historical Archives', icon: Archive },
] as const;

export function DocumentsCatalogRoute() {
  const showToast = useToast();
  const isMobile = useIsMobileViewport(639);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useDocumentRecordsQuery({
    category: selectedCategory,
    search: searchQuery,
  });

  const handleCopySha = (sha: string) => {
    void navigator.clipboard?.writeText(sha);
    setCopiedSha(sha);
    showToast('SHA-256 hash copied ✓');
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'roster_pdf':
        return {
          label: 'Roster Schedule',
          className: 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]',
          icon: FileCheck,
        };
      case 'course_certificate':
        return {
          label: 'Certification',
          className: 'bg-[#DCE7F9] text-[#1E3A8A] border-[#B8CEF2]',
          icon: Award,
        };
      case 'apc':
        return {
          label: 'APC',
          className: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
          icon: ShieldCheck,
        };
      case 'policy':
        return {
          label: 'Policy',
          className: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
          icon: FolderSync,
        };
      default:
        return {
          label: 'Archive',
          className: 'bg-[#F5F5F4] text-[#57534E] border-[#E7E5E4]',
          icon: Archive,
        };
    }
  };

  const renderVisibility = (visibility: string) => {
    if (visibility === 'owner') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#57534E]">
          <Lock className="h-3 w-3 text-[#D97706]" />
          <span>Owner Only</span>
        </span>
      );
    }
    if (visibility === 'self_and_owner') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#57534E]">
          <ShieldCheck className="h-3 w-3 text-[#0F766E]" />
          <span>Self &amp; Owner</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#57534E]">
        <Check className="h-3 w-3 text-[#15803D]" />
        <span>All Staff</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <ModuleBackBar title="Drive Documents" />

      {/* Desktop Header (sr-only on mobile to keep DOM heading while keeping mobile single-bar) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
            Controlled Document Navigator &middot; Google Drive Archive
          </p>
          <h1 className="sr-only lg:not-sr-only text-[26px] font-extrabold tracking-tight text-[#18181B]">
            Documents Catalog &amp; Archives
          </h1>
          <p className="hidden lg:block mt-0.5 text-[13px] font-medium text-[#78716C]">
            Search, inspect cryptographic SHA-256 checksums, and access official department rosters
            and verified credentials archived in Google Drive.
          </p>
        </div>
        <div className="hidden lg:block">
          <StatusBadge label={`${documents.length} Records`} tone="teal" icon={FileText} />
        </div>
      </div>

      {/* Search Bar & Horizontally Scrollable Category Filters */}
      <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-3.5 sm:p-4 space-y-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename, category, or SHA-256 hash..."
              className="h-10 w-full rounded-full border-[1.5px] border-[#E7E5E4] bg-[#FAF8F5] pl-10 pr-4 text-xs font-semibold text-[#18181B] placeholder:text-[#78716C] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
          <span className="lg:hidden shrink-0 rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-2.5 py-1 text-[10.5px] font-extrabold text-[#0F766E]">
            {documents.length}
          </span>
        </div>

        {/* Single-Row Scrollable Category Pills */}
        <div className="flex flex-nowrap gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {DOCUMENT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#18181B] text-white shadow-xs'
                    : 'border border-[#E7E5E4] bg-[#FAF8F5] text-[#57534E] hover:bg-[#EFECE6]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Responsive Documents Content */}
      {isLoading ? (
        isMobile ? (
          <SkeletonCardList count={4} srLabel="Loading archived documents catalog..." />
        ) : (
          <SkeletonTableCard
            rows={5}
            cols={5}
            hasHeaderBar={false}
            srLabel="Loading archived documents catalog..."
          />
        )
      ) : documents.length === 0 ? (
        <div className="rounded-[22px] border border-[#E7E5E4] bg-white px-4 py-12 text-center text-[#78716C] space-y-1.5">
          <FileText className="mx-auto h-6 w-6 opacity-50" />
          <div className="text-xs font-extrabold text-[#18181B]">No documents found</div>
          <div className="text-[11px] font-medium">
            No catalog records matched your active search query or filter.
          </div>
        </div>
      ) : isMobile ? (
        /* Mobile Stacked Cards (zero horizontal table scroll) */
        <div className="space-y-2.5">
          {documents.map((doc: DocumentRecordRow) => {
            const badge = getCategoryBadge(doc.document_category);
            const Icon = badge.icon;
            const isCopied = copiedSha === doc.sha256;
            const archivedDate = new Date(doc.created_at).toLocaleDateString('en-MY', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={doc.id}
                className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)] space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${badge.className}`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{badge.label}</span>
                  </span>
                  <span className="text-[10.5px] font-semibold text-[#78716C]">{archivedDate}</span>
                </div>

                <div>
                  <div className="text-[13px] font-extrabold text-[#18181B] break-words">
                    {doc.file_name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-mono font-bold text-[#57534E]">
                      {formatFileSize(doc.size_bytes)}
                    </span>
                    <span className="text-[#D6D3D1]">&middot;</span>
                    {renderVisibility(doc.visibility)}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[#EFECE6] pt-2.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] text-[#57534E] bg-[#FAF8F5] px-2 py-0.5 rounded-full border border-[#E7E5E4] truncate">
                      SHA: {doc.sha256.slice(0, 12)}…
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopySha(doc.sha256)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#E7E5E4] bg-[#FAF8F5] text-[#57534E] hover:text-[#18181B] cursor-pointer"
                      title="Copy full SHA-256 hash"
                      aria-label="Copy SHA-256 hash"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-[#15803D]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  {doc.drive_web_view_link ? (
                    <a
                      href={doc.drive_web_view_link}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#0F766E] px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-[#115E59] transition"
                    >
                      <span>Open</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-1.5 text-[11px] font-bold text-[#A8A29E] cursor-not-allowed"
                    >
                      <span>No Link</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop Documents Table */
        <div className="rounded-[22px] border border-[#E7E5E4] bg-white overflow-hidden shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EFECE6] bg-[#FAF8F5]">
                <tr>
                  <th className="px-4 py-3 font-extrabold text-[#18181B]">Category</th>
                  <th className="px-4 py-3 font-extrabold text-[#18181B]">
                    File Name &amp; SHA-256
                  </th>
                  <th className="px-4 py-3 font-extrabold text-[#18181B]">Size</th>
                  <th className="px-4 py-3 font-extrabold text-[#18181B]">Visibility</th>
                  <th className="px-4 py-3 font-extrabold text-[#18181B]">Archived At</th>
                  <th className="px-4 py-3 font-extrabold text-[#18181B] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {documents.map((doc: DocumentRecordRow) => {
                  const badge = getCategoryBadge(doc.document_category);
                  const Icon = badge.icon;
                  const isCopied = copiedSha === doc.sha256;

                  return (
                    <tr key={doc.id} className="hover:bg-[#FAF8F5]/70 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold ${badge.className}`}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top space-y-1">
                        <div className="font-extrabold text-[#18181B]">{doc.file_name}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-[#57534E] bg-[#FAF8F5] px-2 py-0.5 rounded-full border border-[#E7E5E4]">
                            SHA: {doc.sha256.slice(0, 16)}…
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopySha(doc.sha256)}
                            className="text-[#78716C] hover:text-[#18181B] transition-colors p-0.5 rounded cursor-pointer"
                            title="Copy full SHA-256 hash"
                            aria-label="Copy SHA-256 hash"
                          >
                            {isCopied ? (
                              <Check className="h-3 w-3 text-[#15803D]" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top font-mono font-semibold text-[#57534E]">
                        {formatFileSize(doc.size_bytes)}
                      </td>

                      <td className="px-4 py-3 align-top">{renderVisibility(doc.visibility)}</td>

                      <td className="px-4 py-3 align-top font-semibold text-[#78716C]">
                        {new Date(doc.created_at).toLocaleDateString('en-MY', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      <td className="px-4 py-3 align-top text-right">
                        {doc.drive_web_view_link ? (
                          <a
                            href={doc.drive_web_view_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-white px-3 py-1 text-xs font-extrabold text-[#18181B] hover:bg-[#FAF8F5] transition-colors"
                          >
                            <span>Open</span>
                            <ExternalLink className="h-3 w-3 text-[#0F766E]" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-1 text-xs font-bold text-[#A8A29E] cursor-not-allowed"
                          >
                            <span>Open</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
