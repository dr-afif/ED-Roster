import type { ShiftBucket, ShiftSemanticClass, ShiftSemanticDefinition } from './types';

export const CANONICAL_SHIFT_SEMANTICS: readonly ShiftSemanticDefinition[] = [
  {
    shiftCode: 'AM',
    semanticClass: 'worked',
    providesCoverage: true,
    nightPolicyBQualifying: false,
    displacesOffEarnsGoff: false,
    bucket: 'am',
  },
  {
    shiftCode: 'PM',
    semanticClass: 'worked',
    providesCoverage: true,
    nightPolicyBQualifying: false,
    displacesOffEarnsGoff: false,
    bucket: 'pm',
  },
  {
    shiftCode: 'ON',
    semanticClass: 'worked',
    providesCoverage: true,
    nightPolicyBQualifying: true,
    displacesOffEarnsGoff: false,
    bucket: 'night',
  },
  {
    shiftCode: 'ON1',
    semanticClass: 'worked',
    providesCoverage: true,
    nightPolicyBQualifying: true,
    displacesOffEarnsGoff: false,
    bucket: 'night',
  },
  {
    shiftCode: 'ON2',
    semanticClass: 'worked',
    providesCoverage: true,
    nightPolicyBQualifying: true,
    displacesOffEarnsGoff: false,
    bucket: 'night',
  },
  {
    shiftCode: 'NIGHT',
    semanticClass: 'worked',
    providesCoverage: true,
    nightPolicyBQualifying: true,
    displacesOffEarnsGoff: false,
    bucket: 'night',
  },
  {
    shiftCode: 'N',
    semanticClass: 'worked',
    providesCoverage: true,
    nightPolicyBQualifying: true,
    displacesOffEarnsGoff: false,
    bucket: 'night',
  },
  {
    shiftCode: 'PN',
    semanticClass: 'transparent',
    providesCoverage: false,
    nightPolicyBQualifying: true,
    displacesOffEarnsGoff: false,
  },
  {
    shiftCode: 'OFF',
    semanticClass: 'reset',
    providesCoverage: false,
    nightPolicyBQualifying: false,
    displacesOffEarnsGoff: false,
  },
  {
    shiftCode: 'GOFF',
    semanticClass: 'reset',
    providesCoverage: false,
    nightPolicyBQualifying: false,
    displacesOffEarnsGoff: false,
  },
  {
    shiftCode: 'AL',
    semanticClass: 'reset',
    providesCoverage: false,
    nightPolicyBQualifying: false,
    displacesOffEarnsGoff: false,
  },
  {
    shiftCode: 'MC',
    semanticClass: 'reset',
    providesCoverage: false,
    nightPolicyBQualifying: false,
    displacesOffEarnsGoff: false,
  },
  {
    shiftCode: 'EL',
    semanticClass: 'reset',
    providesCoverage: false,
    nightPolicyBQualifying: false,
    displacesOffEarnsGoff: false,
  },
  {
    shiftCode: 'HKA',
    semanticClass: 'reset',
    providesCoverage: false,
    nightPolicyBQualifying: false,
    displacesOffEarnsGoff: false,
  },
  {
    shiftCode: 'GHKA',
    semanticClass: 'reset',
    providesCoverage: false,
    nightPolicyBQualifying: false,
    displacesOffEarnsGoff: false,
  },
  {
    shiftCode: 'COURSE',
    semanticClass: 'reset',
    providesCoverage: false,
    nightPolicyBQualifying: false,
    displacesOffEarnsGoff: false,
  },
];

/**
 * Normalizes raw shift codes into uppercase trimmed base and optional modifier.
 * Examples: "AM" -> { raw: "AM", base: "AM" }, "AM(S)" -> { raw: "AM(S)", base: "AM", modifier: "S" }
 */
export function normalizeShiftCode(rawCode: string | null | undefined): {
  raw: string;
  base: string;
  modifier?: string;
} {
  if (!rawCode) {
    return { raw: '', base: '' };
  }
  const clean = rawCode.trim().toUpperCase();
  const match = clean.match(/^([A-Z0-9]+)(?:\(([A-Z0-9]+)\))?$/);
  if (!match) {
    return { raw: clean, base: clean };
  }
  return {
    raw: clean,
    base: match[1] ?? clean,
    modifier: match[2],
  };
}

/**
 * Resolves semantic definition for a shift code from configuration or canonical defaults.
 */
export function getShiftSemantic(
  code: string | null | undefined,
  customSemantics?: readonly ShiftSemanticDefinition[],
): ShiftSemanticDefinition {
  const { base, raw } = normalizeShiftCode(code);
  if (!base) {
    return {
      shiftCode: '',
      semanticClass: 'reset',
      providesCoverage: false,
      nightPolicyBQualifying: false,
      displacesOffEarnsGoff: false,
    };
  }

  // Look in customSemantics first
  if (customSemantics && customSemantics.length > 0) {
    const custom = customSemantics.find(
      (s) => s.shiftCode.toUpperCase() === base || s.shiftCode.toUpperCase() === raw,
    );
    if (custom) return custom;
  }

  // Look in canonical defaults
  const canonical = CANONICAL_SHIFT_SEMANTICS.find(
    (s) => s.shiftCode.toUpperCase() === base || s.shiftCode.toUpperCase() === raw,
  );
  if (canonical) return canonical;

  // Unknown shift code
  return {
    shiftCode: raw,
    semanticClass: 'unknown' as ShiftSemanticClass,
    providesCoverage: false,
    nightPolicyBQualifying: false,
    displacesOffEarnsGoff: false,
  };
}

export function isWorkedShift(
  code: string | null | undefined,
  customSemantics?: readonly ShiftSemanticDefinition[],
): boolean {
  return getShiftSemantic(code, customSemantics).semanticClass === 'worked';
}

export function isTransparentShift(
  code: string | null | undefined,
  customSemantics?: readonly ShiftSemanticDefinition[],
): boolean {
  return getShiftSemantic(code, customSemantics).semanticClass === 'transparent';
}

export function isResetShift(
  code: string | null | undefined,
  customSemantics?: readonly ShiftSemanticDefinition[],
): boolean {
  return getShiftSemantic(code, customSemantics).semanticClass === 'reset';
}

export function isQualifyingNightShift(
  code: string | null | undefined,
  nightQualifyingCodes?: readonly string[],
  customSemantics?: readonly ShiftSemanticDefinition[],
): boolean {
  const { base, raw } = normalizeShiftCode(code);
  if (!base) return false;

  if (nightQualifyingCodes && nightQualifyingCodes.length > 0) {
    const upperCodes = nightQualifyingCodes.map((c) => c.toUpperCase());
    if (upperCodes.includes(base) || upperCodes.includes(raw)) {
      return true;
    }
  }

  const semantic = getShiftSemantic(code, customSemantics);
  return semantic.nightPolicyBQualifying || semantic.bucket === 'night';
}

export function getShiftBucket(
  code: string | null | undefined,
  customSemantics?: readonly ShiftSemanticDefinition[],
): ShiftBucket | undefined {
  return getShiftSemantic(code, customSemantics).bucket;
}
