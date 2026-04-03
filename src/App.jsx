import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, initializeAuth } from './hooks/useAuth';
import { useAppStore } from './store/useAppStore';
import { usePermissions } from './hooks/usePermissions';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Calendar from './pages/Calendar';
import Patients from './pages/Patients';
import Conversations from './pages/Conversations';
import PatientHistory from './pages/PatientHistory';
import Stats from './pages/Stats';
import Users from './pages/Users';
import AuditLog from './pages/AuditLog';
import Login from './pages/Login';
import ToastContainer from './components/ToastContainer';

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

export default function App() {
    const { setAuth, setLoading, clearAuth } = useAppStore();
    const { canViewStats, canManageRoles } = usePermissions();

    useEffect(() => {
        let subscription;
        initializeAuth(setAuth, setLoading, clearAuth).then(sub => {
            subscription = sub;
        });
        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    return (
        <>
        <ToastContainer />
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/*" element={
                <ProtectedRoute>
                    <div className="h-screen w-screen relative overflow-hidden bg-transparent p-4 lg:p-6 flex items-center justify-center">
                        {/* Macro Módulo Unificado - Sensación Voladora y de Cristal */}
                        <div className="w-full max-w-[1920px] h-full rounded-[24px] sm:rounded-[32px] bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_20px_50px_rgba(26,58,107,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] overflow-hidden relative z-10 flex">
                            <Sidebar />
                            <div className="flex-1 ml-[240px] flex flex-col relative w-full h-full">
                                <Topbar />
                                <main className="flex-1 px-4 lg:px-6 pb-4 w-full h-full block overflow-hidden">
                                    <Routes>
                                        <Route path="/" element={<Calendar />} />
                                        <Route path="/patients" element={<Patients />} />
                                        <Route path="/conversations" element={<Conversations />} />
                                        <Route path="/patients/:id/history" element={<PatientHistory />} />
                                        <Route path="/stats" element={canViewStats ? <Stats /> : <Navigate to="/" replace />} />
                                        <Route path="/users" element={canManageRoles ? <Users /> : <Navigate to="/" replace />} />
                                        <Route path="/audit-log" element={canManageRoles ? <AuditLog /> : <Navigate to="/" replace />} />
                                        <Route path="*" element={<Navigate to="/" replace />} />
                                    </Routes>
                                </main>
                            </div>
                        </div>
                    </div>
                </ProtectedRoute>
            } />
        </Routes>
        </>
    );
}
