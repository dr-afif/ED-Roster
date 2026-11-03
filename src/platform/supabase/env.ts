import { z } from 'zod';
import type { AppEnvironment } from '@/shared/types';

export type RawEnvRecord = {
  readonly VITE_SUPABASE_URL?: unknown;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: unknown;
  readonly VITE_APP_ENV?: unknown;
  readonly BASE_URL?: unknown;
  readonly MODE?: unknown;
  readonly DEV?: unknown;
  readonly PROD?: unknown;
};

export type PublicSupabaseMetadata = {
  readonly appEnv: AppEnvironment;
  readonly projectRef: string;
  readonly supabaseOrigin: string;
  readonly basePath: string;
  readonly isProduction: boolean;
};

export type ValidatedSupabaseEnv = PublicSupabaseMetadata & {
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
};

export class EnvironmentConfigurationError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(
      [
        'Invalid Supabase environment configuration:',
        ...issues.map((issue) => `  - ${issue}`),
        'Copy .env.example to .env.local and supply staging VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
      ].join('\n'),
    );
    this.name = 'EnvironmentConfigurationError';
    this.issues = issues;
  }
}

const PLACEHOLDER_URL_PATTERN = /your-staging-project-ref|example\.supabase\.co|placeholder|[<>]/i;
const PLACEHOLDER_KEY_PATTERN = /your_staging_key_here|replace_with|placeholder|[<>]/i;
const PUBLISHABLE_KEY_PATTERN = /^sb_publishable_[A-Za-z0-9_-]{16,}$/;

function containsJwtServiceRole(candidate: string): boolean {
  const segments = candidate.split('.');
  if (segments.length !== 3 || !segments[1]) {
    return false;
  }
  try {
    const normalized = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    return /"role"\s*:\s*"service_role"/i.test(decoded);
  } catch {
    return false;
  }
}

function normalizeBasePath(rawBase: unknown): string {
  if (typeof rawBase !== 'string' || rawBase.trim() === '' || rawBase.trim() === '/') {
    return '/';
  }
  const trimmed = rawBase.trim();
  const leading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return leading.endsWith('/') ? leading : `${leading}/`;
}

function deriveProjectRef(parsedUrl: URL): string {
  const host = parsedUrl.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'local-stack';
  }
  if (host.endsWith('.supabase.co')) {
    const [ref] = host.split('.');
    if (ref && ref.length > 0) {
      return ref;
    }
  }
  return host;
}

const appEnvSchema = z.enum(['local', 'staging', 'production', 'test']);

export function validateSupabaseEnv(rawEnv: RawEnvRecord): ValidatedSupabaseEnv {
  const issues: string[] = [];

  const rawUrl =
    typeof rawEnv.VITE_SUPABASE_URL === 'string' ? rawEnv.VITE_SUPABASE_URL.trim() : '';
  const rawKey =
    typeof rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY === 'string'
      ? rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY.trim()
      : '';

  let parsedUrl: URL | null = null;

  if (!rawUrl) {
    issues.push('VITE_SUPABASE_URL is missing or empty.');
  } else if (PLACEHOLDER_URL_PATTERN.test(rawUrl)) {
    issues.push(
      'VITE_SUPABASE_URL still contains a template placeholder; set it to your staging Supabase project URL.',
    );
  } else {
    try {
      parsedUrl = new URL(rawUrl);
      const isLocalHost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
      if (parsedUrl.username || parsedUrl.password) {
        issues.push('VITE_SUPABASE_URL must not embed credentials in the URL.');
      }
      if (parsedUrl.protocol !== 'https:' && !(isLocalHost && parsedUrl.protocol === 'http:')) {
        issues.push(
          'VITE_SUPABASE_URL must use https:// (http:// is allowed only for localhost/127.0.0.1).',
        );
      }
    } catch {
      issues.push('VITE_SUPABASE_URL is not a valid URL.');
    }
  }

  if (!rawKey) {
    issues.push('VITE_SUPABASE_PUBLISHABLE_KEY is missing or empty.');
  } else if (rawKey.startsWith('sb_secret_')) {
    issues.push(
      'VITE_SUPABASE_PUBLISHABLE_KEY contains a secret key (sb_secret_*). Browser code must never receive secret keys.',
    );
  } else if (/service_role/i.test(rawKey) || containsJwtServiceRole(rawKey)) {
    issues.push(
      'VITE_SUPABASE_PUBLISHABLE_KEY contains a privileged service_role credential. Only a publishable browser key is allowed.',
    );
  } else if (PLACEHOLDER_KEY_PATTERN.test(rawKey)) {
    issues.push(
      'VITE_SUPABASE_PUBLISHABLE_KEY still contains a template placeholder; set it to your staging publishable key.',
    );
  } else if (!PUBLISHABLE_KEY_PATTERN.test(rawKey)) {
    issues.push(
      'VITE_SUPABASE_PUBLISHABLE_KEY is malformed; expected format starting with sb_publishable_.',
    );
  }

  const mode = typeof rawEnv.MODE === 'string' ? rawEnv.MODE : 'development';
  const isDev = Boolean(rawEnv.DEV);
  const rawAppEnv =
    typeof rawEnv.VITE_APP_ENV === 'string' && rawEnv.VITE_APP_ENV.trim() !== ''
      ? rawEnv.VITE_APP_ENV.trim().toLowerCase()
      : undefined;

  let resolvedAppEnv: AppEnvironment = 'staging';
  if (rawAppEnv !== undefined) {
    const parsedEnv = appEnvSchema.safeParse(rawAppEnv);
    if (!parsedEnv.success) {
      issues.push('VITE_APP_ENV must be one of: local, staging, production, test.');
    } else {
      resolvedAppEnv = parsedEnv.data;
    }
  } else if (mode === 'test') {
    resolvedAppEnv = 'test';
  } else if (
    parsedUrl &&
    (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')
  ) {
    resolvedAppEnv = 'local';
  } else {
    resolvedAppEnv = 'staging';
  }

  if (resolvedAppEnv === 'production' && (mode === 'test' || isDev)) {
    issues.push(
      'VITE_APP_ENV=production is forbidden during local development and automated test execution.',
    );
  }

  if (issues.length > 0 || !parsedUrl) {
    throw new EnvironmentConfigurationError(issues);
  }

  const normalizedOrigin = parsedUrl.origin;

  return Object.freeze({
    supabaseUrl: normalizedOrigin,
    supabaseOrigin: normalizedOrigin,
    supabasePublishableKey: rawKey,
    projectRef: deriveProjectRef(parsedUrl),
    appEnv: resolvedAppEnv,
    basePath: normalizeBasePath(rawEnv.BASE_URL),
    isProduction: resolvedAppEnv === 'production',
  });
}

export function getRuntimeSupabaseEnv(): ValidatedSupabaseEnv {
  return validateSupabaseEnv(import.meta.env);
}
