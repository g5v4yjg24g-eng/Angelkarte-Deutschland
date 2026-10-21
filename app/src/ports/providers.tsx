import type { ReactNode } from 'react';
import { ProvidersContext, type Providers } from './providersContext';

export function ProvidersProvider({ value, children }: { value: Providers; children: ReactNode }) {
  return <ProvidersContext.Provider value={value}>{children}</ProvidersContext.Provider>;
}
