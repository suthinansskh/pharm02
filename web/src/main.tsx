import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { AdminProvider } from './admin';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import { Loading } from './components/State';
import RecordPage from './pages/RecordPage';
import './styles.css';

// Heavier / less-visited pages are split into their own chunks.
const EventsPage = lazy(() => import('./pages/EventsPage'));
const SummaryPage = lazy(() => import('./pages/SummaryPage'));
const VolunteerPage = lazy(() => import('./pages/VolunteerPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

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
                  <Route index element={<RecordPage />} />
                  <Route path="events" element={<EventsPage />} />
                  <Route path="summary" element={<SummaryPage />} />
                  <Route path="volunteer" element={<VolunteerPage />} />
                  <Route path="admin" element={<AdminPage />} />
                </Route>
              </Routes>
            </Suspense>
          </HashRouter>
        </AdminProvider>
      </ToastProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);
