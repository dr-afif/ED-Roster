import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Architecture & Blueprint Integrity Boundaries', () => {
  const repoRoot = process.cwd();
  const srcRoot = path.join(repoRoot, 'src');

  it('prevents platform/ and shared/ modules from importing features/ or routes/', () => {
    const foundationDirs = [path.join(srcRoot, 'platform'), path.join(srcRoot, 'shared')];
    const forbiddenImport = /from\s+['"](?:@\/|\.\.\/.*)(?:features|routes)(?:\/|['"])/;

    for (const dir of foundationDirs) {
      for (const file of collectSourceFiles(dir)) {
        const content = fs.readFileSync(file, 'utf8');
        expect(
          forbiddenImport.test(content),
          `Forbidden upward import detected in ${path.relative(repoRoot, file)}`,
        ).toBe(false);
      }
    }
  });

  it('prevents hard-coded Supabase project URLs or API keys in production source files', () => {
    const nonTestFiles = collectSourceFiles(srcRoot).filter(
      (file) =>
        !file.includes(`${path.sep}__tests__${path.sep}`) &&
        !file.endsWith('.test.ts') &&
        !file.endsWith('.test.tsx'),
    );

    const hardcodedUrlPattern = /https:\/\/[a-z0-9-]+\.supabase\.co/i;
    const hardcodedKeyLiteralPattern = /sb_(?:publishable|secret)_[A-Za-z0-9_-]{8,}/;

    for (const file of nonTestFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(
        hardcodedUrlPattern.test(content),
        `Hard-coded Supabase URL found in ${path.relative(repoRoot, file)}`,
      ).toBe(false);
      expect(
        hardcodedKeyLiteralPattern.test(content),
        `Hard-coded Supabase key found in ${path.relative(repoRoot, file)}`,
      ).toBe(false);
    }
  });

  it('preserves the complete MODULAR_APP_BLUEPRINT baseline files', () => {
    const blueprintRoot = path.join(repoRoot, 'MODULAR_APP_BLUEPRINT');
    const requiredFiles = [
      'README.md',
      'AGENTS.md',
      'project-manifest.yaml',
      '00_PRODUCT_VISION_SCOPE.md',
      '01_LEGACY_BASELINE.md',
      '02_TARGET_ARCHITECTURE.md',
      '03_DATA_MODEL.md',
      '04_SECURITY_AUTHORIZATION.md',
      '05_ROSTER_RULES_ENGINE.md',
      '06_GOOGLE_DRIVE_DOCUMENTS.md',
      '07_PDF_TELEGRAM_WORKFLOW.md',
      '08_FRONTEND_UX.md',
      '09_MIGRATION_CUTOVER.md',
      '10_TESTING_ACCEPTANCE.md',
      '11_DELIVERY_ROADMAP.md',
      '12_DEPLOYMENT_OPERATIONS.md',
      '13_MULTI_AGENT_WORKFLOW.md',
      '14_DECISIONS_OPEN_QUESTIONS.md',
      '15_REQUIREMENTS_TRACEABILITY.md',
      'decisions/ADR-001-modular-monolith-supabase.md',
      'decisions/ADR-002-sheets-import-not-dual-write.md',
      'decisions/ADR-003-drive-bytes-supabase-metadata.md',
      'decisions/ADR-004-immutable-pdf-personal-telegram.md',
      'decisions/ADR-005-versioned-typed-rules.md',
      'decisions/ADR-006-separate-supabase-environments.md',
      'decisions/ADR-007-github-pages-routing-strategy.md',
      'templates/ADR.md',
      'templates/HANDOFF.md',
      'templates/PR_CHECKLIST.md',
      'templates/TASK_BRIEF.md',
    ];

    for (const rel of requiredFiles) {
      const target = path.join(blueprintRoot, rel);
      expect(fs.existsSync(target), `Missing blueprint file: ${rel}`).toBe(true);
    }
  });
});
