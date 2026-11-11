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
import { PageHeader, StatusBadge, SurfaceCard } from '@/shared/ui';
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useDocumentRecordsQuery({
    category: selectedCategory,
    search: searchQuery,
  });

  const handleCopySha = (sha: string) => {
    void navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
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
          className: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
          icon: FileCheck,
        };
      case 'course_certificate':
        return {
          label: 'Certification',
          className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
          icon: Award,
        };
      case 'apc':
        return {
          label: 'APC',
          className:
            'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
          icon: ShieldCheck,
        };
      case 'policy':
        return {
          label: 'Policy',
          className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
          icon: FolderSync,
        };
      default:
        return {
          label: 'Archive',
          className: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
          icon: Archive,
        };
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controlled Document Navigator · Google Drive Archive"
        title="Documents Catalog & Archives"
        description="Search, inspect cryptographic SHA-256 checksums, and access official department rosters and verified credentials archived in Google Drive."
        actions={<StatusBadge label={`${documents.length} Records`} tone="brand" icon={FileText} />}
      />

      {/* Search Bar & Category Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename, category, or SHA-256 hash..."
              className="h-10 w-full rounded-xl border border-border-default bg-surface-primary pl-10 pr-4 text-xs text-text-primary focus:border-brand-primary focus:outline-none shadow-xs"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isSelected
                    ? 'bg-brand-primary text-text-inverse shadow-xs'
                    : 'border border-border-default bg-surface-primary text-text-secondary hover:bg-surface-secondary'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Documents Table */}
      <SurfaceCard variant="solid" className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border-default bg-surface-secondary/70">
              <tr>
                <th className="px-4 py-3 font-semibold text-text-primary">Category</th>
                <th className="px-4 py-3 font-semibold text-text-primary">
                  File Name &amp; SHA-256
                </th>
                <th className="px-4 py-3 font-semibold text-text-primary">Size</th>
                <th className="px-4 py-3 font-semibold text-text-primary">Visibility</th>
                <th className="px-4 py-3 font-semibold text-text-primary">Archived At</th>
                <th className="px-4 py-3 font-semibold text-text-primary text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                    Loading archived documents catalog...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                    <div className="space-y-1">
                      <FileText className="mx-auto h-6 w-6 text-text-muted opacity-50" />
                      <div className="font-semibold text-text-primary">No documents found</div>
                      <div className="text-[11px]">
                        No catalog records matched your active search query or filter.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                documents.map((doc: DocumentRecordRow) => {
                  const badge = getCategoryBadge(doc.document_category);
                  const Icon = badge.icon;
                  const isCopied = copiedSha === doc.sha256;

                  return (
                    <tr key={doc.id} className="hover:bg-surface-secondary/30 transition-colors">
                      {/* Category */}
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* File Name & SHA-256 */}
                      <td className="px-4 py-3 align-top space-y-1">
                        <div className="font-semibold text-text-primary">{doc.file_name}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-text-muted bg-surface-secondary px-2 py-0.5 rounded border border-border-subtle">
                            SHA: {doc.sha256.slice(0, 16)}…
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopySha(doc.sha256)}
                            className="text-text-muted hover:text-text-primary transition-colors p-0.5 rounded"
                            title="Copy full SHA-256 hash"
                            aria-label="Copy SHA-256 hash"
                          >
                            {isCopied ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3 align-top font-mono text-text-secondary">
                        {formatFileSize(doc.size_bytes)}
                      </td>

                      {/* Visibility */}
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
                          {doc.visibility === 'owner' ? (
                            <>
                              <Lock className="h-3 w-3 text-amber-500" />
                              <span>Owner Only</span>
                            </>
                          ) : doc.visibility === 'self_and_owner' ? (
                            <>
                              <ShieldCheck className="h-3 w-3 text-blue-500" />
                              <span>Self &amp; Owner</span>
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3 text-emerald-500" />
                              <span>All Staff</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 align-top text-text-muted">
                        {new Date(doc.created_at).toLocaleDateString('en-MY', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 align-top text-right">
                        <a
                          href={doc.drive_web_view_link ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-primary px-2.5 py-1 text-xs font-semibold text-text-primary hover:bg-surface-secondary transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink className="h-3 w-3 text-brand-primary" />
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* ADR-003 Blueprint Architecture Note */}
      <SurfaceCard variant="glass" className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
          <FolderSync className="h-4 w-4 text-brand-primary" />
          ADR-003: Google Drive Document Storage &amp; Cryptographic SHA-256 Audit
        </div>
        <p className="text-[11px] leading-relaxed text-text-secondary">
          Documents and roster PDF snapshots are securely archived in Google Drive. Supabase stores
          metadata, ownership, and SHA-256 hashes, ensuring tamper-evident audit records and
          resilience against human folder renames.
        </p>
      </SurfaceCard>
    </div>
  );
}
