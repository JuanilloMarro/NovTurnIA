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
import Login from './pages/Login';

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
        initializeAuth(setAuth, setLoading, clearAuth);
    }, []);

    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/*" element={
                <ProtectedRoute>
                    <div className="flex min-h-screen relative z-10">
                        <Sidebar />
                        <div className="flex-1 ml-[240px] flex flex-col">
                            <Topbar />
                            <main className="flex-1 p-6">
                                <Routes>
                                    <Route path="/" element={<Calendar />} />
                                    <Route path="/patients" element={<Patients />} />
                                    <Route path="/conversations" element={<Conversations />} />
                                    <Route path="/patients/:id/history" element={<PatientHistory />} />
                                    <Route path="/stats" element={canViewStats ? <Stats /> : <Navigate to="/" replace />} />
                                    <Route path="/users" element={canManageRoles ? <Users /> : <Navigate to="/" replace />} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </main>
                        </div>
                    </div>
                </ProtectedRoute>
            } />
        </Routes>
    );
}
