import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RosterSnapshotBar } from '../components/RosterSnapshotBar';

const mockArchiveMutate = vi.fn().mockResolvedValue({
  snapshot: {
    id: 'snap-uuid-1',
    period_id: 1,
    snapshot_version: 1,
    file_name: 'ED_Roster_2027-01_v01_Initial.pdf',
    pdf_sha256: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890',
  },
  pdfResult: {
    pdfBytes: new Uint8Array([1, 2, 3]),
    pdfSha256: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890',
    fileName: 'ED_Roster_2027-01_v01_Initial.pdf',
  },
});

const mockTelegramMutate = vi.fn().mockResolvedValue({
  id: 1,
  status: 'sent',
});

vi.mock('../data/snapshotQueries', () => ({
  useRosterSnapshotsQuery: () => ({
    data: [
      {
        id: 'snap-uuid-1',
        period_id: 1,
        source_revision: 0,
        snapshot_version: 1,
        snapshot_type: 'initial',
        file_name: 'ED_Roster_2027-01_v01_Initial.pdf',
        pdf_sha256: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890',
        created_at: '2027-01-01T10:00:00Z',
      },
    ],
    isLoading: false,
  }),
  useRosterSnapshotDeliveriesQuery: () => ({
    data: [],
    isLoading: false,
  }),
  useArchiveRosterSnapshotMutation: () => ({
    mutateAsync: mockArchiveMutate,
    isPending: false,
  }),
  useSendToTelegramMutation: () => ({
    mutateAsync: mockTelegramMutate,
    isPending: false,
  }),
}));

// Mock window.open
const mockWindowOpen = vi.fn();
window.open = mockWindowOpen;

function renderBar(revision = 0, isOwner = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RosterSnapshotBar
        periodId={1}
        periodYear="2027"
        periodMonth="01"
        periodStart="2027-01-01"
        periodRevision={revision}
        staffList={[
          {
            id: 1,
            staffCode: 'MO-ADMIN',
            displayName: 'Dr Muhammad Afif',
            rosterName: 'Dr Afif',
            staffGroup: 'Medical Officer',
            active: true,
          },
        ]}
        assignments={[{ staffId: 1, dutyDate: '2027-01-01', shiftCode: 'AM' }]}
        shiftDefinitions={[
          {
            code: 'AM',
            label: 'Morning Shift (08:00 - 16:00)',
            short_label: 'AM',
            color_token: 'am',
            sort_order: 10,
            is_active: true,
            start_time: '08:00:00',
            end_time: '16:00:00',
            duration_hours: 8.0,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]}
        isOwner={isOwner}
      />
    </QueryClientProvider>,
  );
}

describe('RosterSnapshotBar (Wave F Workflow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders snapshot bar with archive status and action buttons', () => {
    renderBar(0);

    expect(screen.getByText('Roster Document Archive & Telegram Workflow')).toBeInTheDocument();
    expect(screen.getByText('v1 Archived')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preview PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send to My Telegram/i })).toBeInTheDocument();
  });

  it('generates PDF preview when clicking Preview PDF', async () => {
    renderBar(0);

    const previewBtn = screen.getByRole('button', { name: /Preview PDF/i });
    fireEvent.click(previewBtn);

    expect(screen.getByText('Select Roster PDF Format to Preview')).toBeInTheDocument();
    const previewTableBtn = screen.getByRole('button', { name: /Preview Table/i });
    fireEvent.click(previewTableBtn);

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    });
  });

  it('opens confirmation modal and dispatches snapshot to owner Telegram', async () => {
    renderBar(0);

    const telegramBtn = screen.getByRole('button', { name: /Send to My Telegram/i });
    fireEvent.click(telegramBtn);

    expect(screen.getByText('Send Snapshot to Telegram')).toBeInTheDocument();
    expect(screen.getByText('Department Owner Private Chat')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Send/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockTelegramMutate).toHaveBeenCalledTimes(1);
      expect(mockTelegramMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshotId: 'snap-uuid-1',
        }),
      );
    });
  });

  it('shows Archive Revision button when unarchived amendment revision exists', () => {
    // Period revision 2, but snapshot is revision 0
    renderBar(2);

    expect(screen.getByText(/Revision 2 \(Unarchived Delta\)/i)).toBeInTheDocument();
    const archiveBtn = screen.getByRole('button', {
      name: /Archive Revision 2 Snapshot/i,
    });
    expect(archiveBtn).toBeEnabled();

    fireEvent.click(archiveBtn);
    expect(mockArchiveMutate).toHaveBeenCalledTimes(1);
  });
});
