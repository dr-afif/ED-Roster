import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from 'vite';
import { describe, expect, it } from 'vitest';
import { EnvironmentConfigurationError, validateSupabaseEnv } from '@/platform/supabase';

const VALID_STAGING_FIXTURE = {
  VITE_SUPABASE_URL: 'https://stagingfixtureproj.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_valid_staging_fixture_123456',
  BASE_URL: '/ED-Roster/',
  MODE: 'development',
  DEV: true,
};

describe('validateSupabaseEnv', () => {
  it('accepts valid staging configuration and normalizes metadata', () => {
    const config = validateSupabaseEnv(VALID_STAGING_FIXTURE);

    expect(config.supabaseUrl).toBe('https://stagingfixtureproj.supabase.co');
    expect(config.projectRef).toBe('stagingfixtureproj');
    expect(config.appEnv).toBe('staging');
    expect(config.basePath).toBe('/ED-Roster/');
    expect(config.isProduction).toBe(false);
  });

  it('supports localhost http URLs for local Supabase CLI stack testing', () => {
    const config = validateSupabaseEnv({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_cli_fixture_key_123456',
      MODE: 'development',
      DEV: true,
    });

    expect(config.appEnv).toBe('local');
    expect(config.projectRef).toBe('local-stack');
    expect(config.isProduction).toBe(false);
  });

  it('fails with clear messages when required variables are missing', () => {
    expect(() => validateSupabaseEnv({ MODE: 'development', DEV: true })).toThrowError(
      EnvironmentConfigurationError,
    );

    try {
      validateSupabaseEnv({ MODE: 'development', DEV: true });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentConfigurationError);
      const envError = error as EnvironmentConfigurationError;
      expect(envError.issues).toContain('VITE_SUPABASE_URL is missing or empty.');
      expect(envError.issues).toContain('VITE_SUPABASE_PUBLISHABLE_KEY is missing or empty.');
    }
  });

  it('rejects non-HTTPS remote URLs, embedded credentials, and template placeholders', () => {
    expect(() =>
      validateSupabaseEnv({
        ...VALID_STAGING_FIXTURE,
        VITE_SUPABASE_URL: 'http://stagingfixtureproj.supabase.co',
      }),
    ).toThrow(/https:\/\//i);

    expect(() =>
      validateSupabaseEnv({
        ...VALID_STAGING_FIXTURE,
        VITE_SUPABASE_URL: 'https://admin:pass@stagingfixtureproj.supabase.co',
      }),
    ).toThrow(/credentials/i);

    expect(() =>
      validateSupabaseEnv({
        VITE_SUPABASE_URL: 'https://your-staging-project-ref.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_your_staging_key_here',
      }),
    ).toThrow(/placeholder/i);
  });

  it('rejects Supabase secret keys and service_role JWTs without echoing secret values', () => {
    const fakeSecret = 'sb_secret_DO_NOT_ECHO_THIS_VALUE_999999';

    try {
      validateSupabaseEnv({
        ...VALID_STAGING_FIXTURE,
        VITE_SUPABASE_PUBLISHABLE_KEY: fakeSecret,
      });
      expect.fail('Expected EnvironmentConfigurationError for sb_secret_ key');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentConfigurationError);
      const message = (error as Error).message;
      expect(message).toMatch(/secret key/i);
      expect(message).not.toContain('DO_NOT_ECHO_THIS_VALUE_999999');
    }

    const fakeJwtPayload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString(
      'base64url',
    );
    const fakeServiceRoleJwt = `eyJhbGciOiJIUzI1NiJ9.${fakeJwtPayload}.sig`;

    expect(() =>
      validateSupabaseEnv({
        ...VALID_STAGING_FIXTURE,
        VITE_SUPABASE_PUBLISHABLE_KEY: fakeServiceRoleJwt,
      }),
    ).toThrow(/service_role/i);
  });

  it('blocks production environment selection during tests and local development', () => {
    expect(() =>
      validateSupabaseEnv({
        ...VALID_STAGING_FIXTURE,
        VITE_APP_ENV: 'production',
        MODE: 'test',
        DEV: false,
      }),
    ).toThrow(/forbidden/i);

    expect(() =>
      validateSupabaseEnv({
        ...VALID_STAGING_FIXTURE,
        VITE_APP_ENV: 'production',
        MODE: 'development',
        DEV: true,
      }),
    ).toThrow(/forbidden/i);
  });

  it('resolves local .env.local to non-production staging when present on disk', () => {
    const envLocalPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envLocalPath)) {
      return;
    }

    const loaded = loadEnv('development', process.cwd(), 'VITE_');
    const validated = validateSupabaseEnv({
      ...loaded,
      MODE: 'development',
      DEV: true,
    });

    expect(validated.appEnv).toBe('staging');
    expect(validated.isProduction).toBe(false);
    expect(validated.supabasePublishableKey.startsWith('sb_publishable_')).toBe(true);
  });
});
