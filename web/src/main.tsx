import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { AdminProvider } from './admin';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import { Loading } from './components/State';
import RecordPage from './pages/RecordPage';
import './styles.css';

// Everything except the landing page is split into its own chunk.
const VolunteerRecordPage = lazy(() => import('./pages/VolunteerRecordPage'));
const SummaryPage = lazy(() => import('./pages/SummaryPage'));
const VolunteerSummaryPage = lazy(() => import('./pages/VolunteerSummaryPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const VolunteerActivitiesPage = lazy(() => import('./pages/admin/VolunteerActivitiesPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const CategoriesPage = lazy(() => import('./pages/admin/CategoriesPage'));
const ToolsPage = lazy(() => import('./pages/admin/ToolsPage'));

const DAY = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: DAY, refetchOnWindowFocus: false, retry: 1 } },
});

// Stale-while-revalidate: last known events/records render instantly, then refresh in the background.
const persister = createSyncStoragePersister({ storage: window.localStorage, key: 'pharm02.cache' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{
        persister,
        maxAge: DAY,
        buster: 'v3',
        // Queries marked meta.persist === false (user lookups, admin data) never reach localStorage.
        dehydrateOptions: { shouldDehydrateQuery: (q) => defaultShouldDehydrateQuery(q) && q.meta?.persist !== false },
      }}>
      <ToastProvider>
        <AdminProvider>
          <HashRouter>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route element={<Layout />}>
                  {/* บันทึก */}
                  <Route index element={<RecordPage />} />
                  <Route path="volunteer" element={<VolunteerRecordPage />} />
                  {/* สรุปผล */}
                  <Route path="summary" element={<SummaryPage />} />
                  <Route path="summary/volunteer" element={<VolunteerSummaryPage />} />
                  {/* จัดการ (one admin login for the whole section) */}
                  <Route path="admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="events" replace />} />
                    <Route path="events" element={<EventsPage />} />
                    <Route path="volunteer-activities" element={<VolunteerActivitiesPage />} />
                    <Route path="users" element={<UsersPage />} />
                    <Route path="categories" element={<CategoriesPage />} />
                    <Route path="tools" element={<ToolsPage />} />
                  </Route>
                  {/* old links */}
                  <Route path="events" element={<Navigate to="/admin/events" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </HashRouter>
        </AdminProvider>
      </ToastProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);
