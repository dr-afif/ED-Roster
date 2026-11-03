import { createHashRouter, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { appChildRoutes } from '@/routes';
import { AppShell } from './AppShell';

export const rootRouteTree: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    HydrateFallback: AppShell,
    children: appChildRoutes,
  },
];

/**
 * ADR-007: HashRouter is the canonical browser router for GitHub Pages (/ED-Roster/),
 * paired with Supabase Auth PKCE (?code=) callbacks.
 * Router instantiation is isolated here so test suites can inject createMemoryRouter
 * and any future hosting migration changes only this factory.
 */
export function createAppHashRouter() {
  return createHashRouter(rootRouteTree);
}

export function createTestAppRouter(initialEntries: string[] = ['/']) {
  return createMemoryRouter(rootRouteTree, { initialEntries });
}
