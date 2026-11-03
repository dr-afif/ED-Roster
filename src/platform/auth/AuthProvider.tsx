import { useMemo, type ReactNode } from 'react';
import { AuthContext, DEFAULT_SCAFFOLD_AUTH_STATE, type AuthBoundaryState } from './authContext';

type AuthProviderProps = {
  value?: AuthBoundaryState;
  children: ReactNode;
};

export function AuthProvider({ value, children }: AuthProviderProps) {
  const resolvedValue = useMemo(() => value ?? DEFAULT_SCAFFOLD_AUTH_STATE, [value]);
  return <AuthContext.Provider value={resolvedValue}>{children}</AuthContext.Provider>;
}
