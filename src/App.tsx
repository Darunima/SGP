import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import AuthPage from './pages/AuthPage';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import FilesPage from './pages/FilesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';

type Page = 'dashboard' | 'tasks' | 'files' | 'analytics' | 'notifications' | 'settings';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020817] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30 animate-pulse">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-blue-500/20 blur-xl animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold">Collabrix</p>
            <p className="text-slate-500 text-sm mt-0.5">Loading your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <WorkspaceProvider>
      <AppInner currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </WorkspaceProvider>
  );
}

function AppInner({ currentPage, setCurrentPage }: { currentPage: Page; setCurrentPage: (p: Page) => void }) {
  const pages: Record<Page, JSX.Element> = {
    dashboard: <DashboardPage />,
    tasks: <TasksPage />,
    files: <FilesPage />,
    analytics: <AnalyticsPage />,
    notifications: <NotificationsPage />,
    settings: <SettingsPage />,
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {pages[currentPage]}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
