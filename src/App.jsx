import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth, initializeAuth } from './hooks/useAuth';
import { useAppStore } from './store/useAppStore';
import ErrorBoundary from './components/ErrorBoundary';
import { usePermissions } from './hooks/usePermissions';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import AccountStatusModal from './components/AccountStatusModal';
import ToastContainer from './components/ToastContainer';

// T-22: Lazy loading de rutas — los bundles de cada página se cargan solo al navegar.
const Calendar        = lazy(() => import('./pages/Calendar'));
const Patients        = lazy(() => import('./pages/Patients'));
const Conversations   = lazy(() => import('./pages/Conversations'));
const PatientHistory  = lazy(() => import('./pages/PatientHistory'));
const Stats           = lazy(() => import('./pages/Stats'));
const Users           = lazy(() => import('./pages/Users'));
const AuditLog        = lazy(() => import('./pages/AuditLog'));
const AdminOnboarding = lazy(() => import('./pages/AdminOnboarding'));
const Settings         = lazy(() => import('./pages/Settings'));
const BusinessSettings = lazy(() => import('./pages/BusinessSettings'));
const Login            = lazy(() => import('./pages/Login'));

function PageLoader() {
    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
        </div>
    );
}

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F4F5F9] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

// Super-admin: identificado por variable de entorno (no almacena rol en DB)
const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? '';

export default function App() {
    const { setAuth, setLoading, clearAuth, setBusinessStatus, businessStatus, profile } = useAppStore();
    const { canViewStats, canManageRoles, canManageServices } = usePermissions();
    const isSuperAdmin = SUPER_ADMIN_EMAIL && profile?.email === SUPER_ADMIN_EMAIL;
    const location = useLocation();

    useEffect(() => {
        let subscription;
        initializeAuth(setAuth, setLoading, clearAuth, setBusinessStatus).then(sub => {
            subscription = sub;
        });
        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    // Guard: si el perfil aún no cargó, no evalúes permisos — evita redirects prematuros
    const profileReady = !!profile;

    return (
        <ErrorBoundary>
        <ToastContainer />
        <Suspense fallback={null}>
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/*" element={
                <ProtectedRoute>
                    <div className="h-screen w-screen relative overflow-hidden bg-transparent p-4 lg:p-6 flex items-center justify-center">
                        {/* Macro Módulo Unificado - Sensación Voladora y de Cristal */}
                        <div className="w-full max-w-[1920px] h-full rounded-[24px] sm:rounded-[32px] bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_20px_50px_rgba(26,58,107,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] overflow-hidden relative z-10 flex">
                            <Sidebar />
                            {/* ml-0 en mobile (sidebar oculto), md:ml-[240px] en desktop */}
                            <div className="flex-1 ml-0 md:ml-[240px] flex flex-col relative w-full h-full min-w-0">
                                <Topbar />
                                <main className="flex-1 px-4 lg:px-6 pb-4 w-full h-full block overflow-hidden">
                                    {/* key={location.pathname} fuerza remount limpio en cada navegación,
                                        garantizando que useEffect de cada módulo re-ejecute y cargue datos frescos */}
                                    <Suspense fallback={<PageLoader />} key={location.pathname}>
                                        <Routes>
                                            <Route path="/" element={<Calendar />} />
                                            <Route path="/patients" element={<Patients />} />
                                            <Route path="/conversations" element={<Conversations />} />
                                            <Route path="/patients/:id/history" element={<PatientHistory />} />
                                            <Route path="/stats" element={!profileReady ? <PageLoader /> : canViewStats ? <Stats /> : <Navigate to="/" replace />} />
                                            <Route path="/settings" element={!profileReady ? <PageLoader /> : (canManageServices || canManageRoles) ? <Settings /> : <Navigate to="/" replace />} />
                                            <Route path="/users" element={!profileReady ? <PageLoader /> : canManageRoles ? <Users /> : <Navigate to="/" replace />} />
                                            <Route path="/audit-log" element={!profileReady ? <PageLoader /> : canManageRoles ? <AuditLog /> : <Navigate to="/" replace />} />
                                            <Route path="/business" element={!profileReady ? <PageLoader /> : canManageRoles ? <BusinessSettings /> : <Navigate to="/" replace />} />
                                            <Route path="/admin/new-tenant" element={!profileReady ? <PageLoader /> : isSuperAdmin ? <AdminOnboarding /> : <Navigate to="/" replace />} />
                                            <Route path="*" element={<Navigate to="/" replace />} />
                                        </Routes>
                                    </Suspense>
                                </main>
                            </div>
                            {(businessStatus === 'suspended' || businessStatus === 'cancelled') && (
                                <AccountStatusModal status={businessStatus} />
                            )}
                        </div>
                    </div>
                </ProtectedRoute>
            } />
        </Routes>
        </Suspense>
        </ErrorBoundary>
    );
}
