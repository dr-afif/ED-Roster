import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentsCatalogRoute } from '../DocumentsCatalogRoute';

vi.mock('../data/documentQueries', () => ({
  useDocumentRecordsQuery: (filters?: { category?: string; search?: string }) => {
    const allDocs = [
      {
        id: 1,
        document_category: 'roster_pdf',
        file_name: 'ED_Roster_2027-01_v01_Initial.pdf',
        size_bytes: 45200,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        visibility: 'all_staff',
        status: 'active',
        drive_web_view_link: 'https://drive.google.com/file/d/drive_123/view',
        created_at: '2027-01-01T10:00:00Z',
      },
      {
        id: 2,
        document_category: 'apc',
        file_name: 'MO-ADMIN_APC_2027.pdf',
        size_bytes: 120500,
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        visibility: 'self_and_owner',
        status: 'active',
        drive_web_view_link: 'https://drive.google.com/file/d/drive_456/view',
        created_at: '2026-12-15T08:00:00Z',
      },
    ];

    let filtered = allDocs;
    if (filters?.category && filters.category !== 'all') {
      filtered = filtered.filter((d) => d.document_category === filters.category);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter((d) => d.file_name.toLowerCase().includes(q));
    }

    return {
      data: filtered,
      isLoading: false,
    };
  },
}));

function renderCatalog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DocumentsCatalogRoute />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DocumentsCatalogRoute (Drive Document Navigator)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header, category pills, and document records', () => {
    renderCatalog();

    expect(screen.getByText('Documents Catalog & Archives')).toBeInTheDocument();
    expect(screen.getByText('All Documents')).toBeInTheDocument();
    expect(screen.getByText('Roster Schedules')).toBeInTheDocument();
    expect(screen.getByText('ED_Roster_2027-01_v01_Initial.pdf')).toBeInTheDocument();
    expect(screen.getByText('MO-ADMIN_APC_2027.pdf')).toBeInTheDocument();
  });

  it('filters by category when clicking category pill', () => {
    renderCatalog();

    const rosterTab = screen.getByRole('button', { name: /Roster Schedules/i });
    fireEvent.click(rosterTab);

    expect(screen.getByText('ED_Roster_2027-01_v01_Initial.pdf')).toBeInTheDocument();
    expect(screen.queryByText('MO-ADMIN_APC_2027.pdf')).not.toBeInTheDocument();
  });

  it('copies SHA-256 hash when clicking copy button', () => {
    const mockClipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockClipboardWrite,
      },
    });

    renderCatalog();

    const copyButtons = screen.getAllByRole('button', { name: /Copy SHA-256 hash/i });
    const firstCopyButton = copyButtons[0];
    expect(firstCopyButton).toBeDefined();
    if (firstCopyButton) {
      fireEvent.click(firstCopyButton);
    }

    expect(mockClipboardWrite).toHaveBeenCalledWith(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
