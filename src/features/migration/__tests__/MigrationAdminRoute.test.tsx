import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MigrationAdminRoute } from '../MigrationAdminRoute';
import { AuthContext, type AuthBoundaryState } from '@/platform/auth/authContext';
import type { MigrationBatch, MigrationBatchDetails } from '../domain/migrationEngine';

const mockBatches: MigrationBatch[] = [
  {
    id: 'batch-uuid-1',
    batch_id: 'BATCH-20261111-001',
    source_spreadsheet_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    source_label: 'HSAAS Master Workbook',
    export_timestamp: '2026-11-11T10:00:00Z',
    tab_manifest: [{ tabName: 'MasterRoster', rowCount: 93, columnCount: 6 }],
    file_hashes: {},
    importer_version: 'v1.0.0',
    status: 'reconciled',
    reconciliation_summary: {},
    notes: 'Initial test rehearsal',
    created_at: '2026-11-11T10:00:00Z',
    raw_row_count: 93,
  },
];

const mockFirstBatch = mockBatches[0] ?? {
  id: 'batch-uuid-1',
  batch_id: 'BATCH-20261111-001',
  source_spreadsheet_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  source_label: 'HSAAS Master Workbook',
  export_timestamp: '2026-11-11T10:00:00Z',
  tab_manifest: [{ tabName: 'MasterRoster', rowCount: 93, columnCount: 6 }],
  file_hashes: {},
  importer_version: 'v1.0.0',
  status: 'reconciled' as const,
  reconciliation_summary: {},
  notes: 'Initial test rehearsal',
  created_at: '2026-11-11T10:00:00Z',
  raw_row_count: 93,
};

const mockDetails: MigrationBatchDetails = {
  batch: mockFirstBatch,
  tabs: [
    { tab_name: 'StaffDirectory', row_count: 3 },
    { tab_name: 'MasterRoster', row_count: 93 },
  ],
  id_maps: [
    {
      id: 1,
      source_entity: 'staff',
      source_tab: 'StaffDirectory',
      source_key: 'Dr Afif',
      canonical_table: 'staff_directory',
      canonical_id: '1',
      canonical_label: 'Dr Afif',
      confidence: 'exact',
      notes: null,
    },
    {
      id: 2,
      source_entity: 'staff',
      source_tab: 'StaffDirectory',
      source_key: 'Dr Siti',
      canonical_table: 'staff_directory',
      canonical_id: '2',
      canonical_label: 'Dr Siti',
      confidence: 'high',
      notes: null,
    },
    {
      id: 3,
      source_entity: 'staff',
      source_tab: 'StaffDirectory',
      source_key: 'Dr Unknown',
      canonical_table: 'staff_directory',
      canonical_id: '0',
      canonical_label: 'UNRESOLVED: Dr Unknown',
      confidence: 'unresolved',
      notes: null,
    },
  ],
  reconciliation: [
    {
      id: 101,
      period_start: null,
      category: 'staff_directory',
      source_count: 3,
      canonical_count: 2,
      duplicate_count: 0,
      error_count: 1,
      checksum_match: false,
      discrepancies: [],
      reviewer_disposition: 'pending',
      disposition_notes: null,
    },
    {
      id: 102,
      period_start: '2026-12-01',
      category: 'roster_assignments',
      source_count: 93,
      canonical_count: 93,
      duplicate_count: 0,
      error_count: 0,
      checksum_match: true,
      discrepancies: [],
      reviewer_disposition: 'approved',
      disposition_notes: null,
    },
  ],
};

const mockStaffList = [
  { id: 1, staff_code: 'MO-01', roster_name: 'Dr Afif', active: true },
  { id: 2, staff_code: 'MO-02', roster_name: 'Dr Siti', active: true },
];

const mockSaveMapping = vi.fn().mockResolvedValue({});
const mockExecuteTransform = vi.fn().mockResolvedValue({});
const mockCreateBatch = vi.fn().mockResolvedValue({});
const mockStageRows = vi.fn().mockResolvedValue({});
const mockUpdateDisposition = vi.fn().mockResolvedValue({});
const mockRevertBatch = vi.fn().mockResolvedValue({});

vi.mock('../data/migrationQueries', () => ({
  useMigrationBatchesQuery: () => ({
    data: mockBatches,
    isLoading: false,
  }),
  useMigrationBatchDetailsQuery: (batchId: string | null) => ({
    data: batchId ? mockDetails : null,
    isLoading: false,
  }),
  useCreateMigrationBatchMutation: () => ({
    mutateAsync: mockCreateBatch,
    isPending: false,
  }),
  useStageRawRowsMutation: () => ({
    mutateAsync: mockStageRows,
    isPending: false,
  }),
  useSaveIdMappingMutation: () => ({
    mutateAsync: mockSaveMapping,
    isPending: false,
  }),
  useUpdateReconciliationDispositionMutation: () => ({
    mutateAsync: mockUpdateDisposition,
    isPending: false,
  }),
  useExecuteTransformMutation: () => ({
    mutateAsync: mockExecuteTransform,
    isPending: false,
  }),
  useRevertMigrationMutation: () => ({
    mutateAsync: mockRevertBatch,
    isPending: false,
  }),
}));

vi.mock('@/features/directory/useDirectoryAdmin', () => ({
  useStaffDirectoryQuery: () => ({
    data: mockStaffList,
    isLoading: false,
  }),
}));

const authState: AuthBoundaryState = {
  status: 'authenticated',
  user: {
    authUserId: 'test-user-id',
    email: 'admin@example.com',
    role: 'owner',
    staffId: 1,
    staffCode: 'MO-ADMIN',
    displayName: 'Dr Muhammad Afif',
    rosterName: 'Dr Afif',
  },
  unapprovedReason: null,
  unapprovedEmail: null,
  errorMessage: null,
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
  retryBootstrap: vi.fn(),
};

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authState}>
        <MemoryRouter initialEntries={['/admin/migration']}>
          <MigrationAdminRoute />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('MigrationAdminRoute (Wave G Tooling)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders migration batches overview and triggers batch inspection', () => {
    renderWithProviders();

    expect(screen.getByText(/Google Sheets Migration & Cutover Tooling/i)).toBeInTheDocument();
    expect(screen.getByText('BATCH-20261111-001')).toBeInTheDocument();
    expect(screen.getByText('HSAAS Master Workbook')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Inspect/i })).toBeInTheDocument();
  });

  it('inspects batch details, switches tabs, and resolves staff identity mapping', async () => {
    renderWithProviders();

    // 1. Click Inspect button
    fireEvent.click(screen.getByRole('button', { name: /Inspect/i }));

    // 2. Reconciliation tab is active
    expect(screen.getByText(/Domain Reconciliation Results/i)).toBeInTheDocument();
    expect(screen.getByText('roster assignments')).toBeInTheDocument();

    // 3. Switch to Identity Mapping tab
    const identityTab = screen.getByRole('button', { name: /Staff Identity Mapping/i });
    fireEvent.click(identityTab);

    expect(screen.getByText('Dr Unknown')).toBeInTheDocument();
    expect(screen.getByText(/Pending Identity Resolutions/i)).toBeInTheDocument();

    // 4. Open Resolve modal for Dr Unknown
    const resolveButtons = screen.getAllByRole('button', { name: /Resolve|Remap/i });
    const targetResolveBtn = resolveButtons[2];
    expect(targetResolveBtn).toBeDefined();
    if (targetResolveBtn) {
      fireEvent.click(targetResolveBtn);
    }

    expect(screen.getByText(/Resolve Identity: Dr Unknown/i)).toBeInTheDocument();

    // Select canonical staff
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    // Save mapping
    const saveBtn = screen.getByRole('button', { name: /Save Mapping/i });
    fireEvent.click(saveBtn);

    expect(mockSaveMapping).toHaveBeenCalledTimes(1);

    // 5. Switch to Cutover Gate tab
    const cutoverTab = screen.getByRole('button', { name: /Cutover Gate/i });
    fireEvent.click(cutoverTab);

    expect(screen.getByText(/Cutover Readiness Gate & Execution/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Execute Dry-Run Rehearsal/i })).toBeInTheDocument();

    // Trigger dry-run rehearsal
    fireEvent.click(screen.getByRole('button', { name: /Execute Dry-Run Rehearsal/i }));
    expect(mockExecuteTransform).toHaveBeenCalledWith({
      batchId: 'BATCH-20261111-001',
      dryRun: true,
    });
  });
});
