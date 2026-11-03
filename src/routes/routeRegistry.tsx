import type { RouteObject } from 'react-router-dom';
import { DashboardRoute } from '@/features/dashboard';
import { NotFoundRoute } from './NotFoundRoute';

/**
 * Canonical route registration table with native React Router code splitting (08_FRONTEND_UX.md).
 * Contains route registration only; business logic and UI live inside feature modules.
 */
export const appChildRoutes: RouteObject[] = [
  { index: true, Component: DashboardRoute },
  {
    path: 'rosters/:yyyy/:mm',
    lazy: async () => ({
      Component: (await import('@/features/rosters')).RosterPeriodRoute,
    }),
  },
  {
    path: 'requests',
    lazy: async () => ({
      Component: (await import('@/features/requests')).StaffRequestsRoute,
    }),
  },
  {
    path: 'profile/me',
    lazy: async () => ({
      Component: (await import('@/features/profiles')).MyProfileRoute,
    }),
  },
  {
    path: 'records',
    lazy: async () => ({
      Component: (await import('@/features/professional-records')).ProfessionalRecordsRoute,
    }),
  },
  {
    path: 'documents',
    lazy: async () => ({
      Component: (await import('@/features/documents')).DocumentsCatalogRoute,
    }),
  },
  {
    path: 'updates',
    lazy: async () => ({
      Component: (await import('@/features/updates')).UpdatesRoute,
    }),
  },
  {
    path: 'admin/staff',
    lazy: async () => ({
      Component: (await import('@/features/directory')).StaffDirectoryAdminRoute,
    }),
  },
  {
    path: 'admin/requests',
    lazy: async () => ({
      Component: (await import('@/features/requests')).AdminRequestsRoute,
    }),
  },
  {
    path: 'admin/rules',
    lazy: async () => ({
      Component: (await import('@/features/rules')).RulesAdminRoute,
    }),
  },
  {
    path: 'admin/settings',
    lazy: async () => ({
      Component: (await import('@/features/settings')).SettingsAdminRoute,
    }),
  },
  {
    path: 'admin/audit',
    lazy: async () => ({
      Component: (await import('@/features/audit')).AuditAdminRoute,
    }),
  },
  {
    path: 'admin/migration',
    lazy: async () => ({
      Component: (await import('@/features/migration')).MigrationAdminRoute,
    }),
  },
  { path: '*', Component: NotFoundRoute },
];
