import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Calendar from './pages/Calendar';
import Patients from './pages/Patients';
import Conversations from './pages/Conversations';
import PatientHistory from './pages/PatientHistory';
import Stats from './pages/Stats';

export default function App() {
    return (
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
                        <Route path="/stats" element={<Stats />} />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
}
