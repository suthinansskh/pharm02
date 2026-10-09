import { useQuery } from '@tanstack/react-query';
import { api } from './api';

const MINUTE = 60 * 1000;

export const useEvents = () =>
  useQuery({ queryKey: ['events'], queryFn: api.events, staleTime: MINUTE });

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: api.categories, staleTime: 5 * MINUTE });

export const useRecords = (limit?: number) =>
  useQuery({ queryKey: ['records', limit ?? 'all'], queryFn: () => api.records(limit), staleTime: MINUTE });

export const useVolunteers = () =>
  useQuery({ queryKey: ['volunteers'], queryFn: api.volunteers, staleTime: MINUTE });

export const useUser = (psCode: string) =>
  useQuery({
    queryKey: ['user', psCode.toLowerCase()],
    queryFn: () => api.lookup(psCode),
    enabled: psCode.length > 0,
    staleTime: 10 * MINUTE,
    retry: false,
    meta: { persist: false }, // personal data: keep out of localStorage
  });
