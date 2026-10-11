import { createContext, useContext } from 'react';

export type ReportFilters = {
  actor: string;
  variant: string;
  start: string;
  end: string;
  cutoff: string;
};
export const initialReportFilters: ReportFilters = {
  actor: 'human',
  variant: 'all',
  start: '',
  end: '',
  cutoff: '',
};
export const AdminSession = createContext<{
  request: <T>(path: string, body?: unknown) => Promise<T>;
  filters: ReportFilters;
  setFilters: (filters: ReportFilters) => void;
} | null>(null);

export function useAdmin() {
  const session = useContext(AdminSession);
  if (!session) throw new Error('Admin session is unavailable.');
  return session;
}
