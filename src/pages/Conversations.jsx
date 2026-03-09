import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Send, User, MessageCircle } from 'lucide-react';
import { usePatients } from '../hooks/usePatients';
import { getPatientHistory } from '../services/supabaseService';
import { formatPhone } from '../utils/format';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Conversations() {
    const [searchParams, setSearchParams] = useSearchParams();
    const patientIdFromUrl = searchParams.get('patient');

    const { patients, search, handleSearch } = usePatients();
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Auto-select patient from URL if present
    useEffect(() => {
        if (patientIdFromUrl && patients.length > 0) {
            const p = patients.find(p => p.id === patientIdFromUrl);
            if (p) {
                // Remove patient param from URL to clean it
                setSearchParams({}, { replace: true });
                setSelectedPatient(p);
            }
        }
    }, [patientIdFromUrl, patients, setSearchParams]);

    useEffect(() => {
        if (selectedPatient) {
            loadHistory(selectedPatient.id);
        } else {
            setHistory([]);
        }
    }, [selectedPatient]);

    async function loadHistory(id) {
        setLoadingHistory(true);
        const data = await getPatientHistory(id);
        setHistory(data);
        setLoadingHistory(false);
    }

    return (
        <div className="flex flex-col pt-2 max-w-7xl mx-auto h-[calc(100vh-130px)]">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Conversaciones</h1>
                    <p className="text-sm text-gray-500 mt-1">Atención directa vía WhatsApp</p>
                </div>
            </div>

            <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm flex overflow-hidden lg:mb-4">
                {/* Left Panel: Contacts */}
                <div className="w-[340px] border-r border-gray-100 flex flex-col bg-gray-50/30">
                    <div className="p-4 border-b border-gray-100 bg-white">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Search size={16} />
                            </div>
                            <input
                                className="w-full bg-gray-50 border border-gray-200 rounded-full pl-9 pr-4 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition-all placeholder-gray-400"
                                placeholder="Buscar paciente..."
                                value={search}
                                onChange={e => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {patients.map(p => {
                            const isSelected = selectedPatient?.id === p.id;
                            const name = p.display_name || 'Sin nombre';
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPatient(p)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group ${isSelected ? 'bg-navy-50 border border-navy-100' : 'hover:bg-white border border-transparent hover:border-gray-100'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0 transition-all duration-300 ${isSelected ? 'bg-navy-900' : 'bg-gray-300 group-hover:bg-navy-900'}`}>
                                        {getInitials(name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-semibold text-[14px] truncate ${isSelected ? 'text-navy-900' : 'text-gray-700'}`}>{name}</div>
                                        <div className={`text-[12px] truncate mt-0.5 ${isSelected ? 'text-navy-600' : 'text-gray-500'}`}>{formatPhone(p.id)}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Chat */}
                <div className="flex-1 flex flex-col relative bg-white min-w-0">
                    {selectedPatient ? (
                        <>
                            {/* Chat Header */}
                            <div className="h-[68px] px-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0 z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-navy-900 flex items-center justify-center text-white text-[13px] font-bold">
                                        {getInitials(selectedPatient.display_name)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-navy-900 text-[15px]">{selectedPatient.display_name || 'Sin nombre'}</div>
                                        <div className="text-[12px] font-medium text-gray-500">{formatPhone(selectedPatient.id)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gray-50/50 relative rounded-br-2xl">
                                {loadingHistory ? (
                                    <div className="flex justify-center flex-col gap-4">
                                        {Array(4).fill(0).map((_, i) => (
                                            <div key={i} className={`animate-shimmer h-14 w-3/4 rounded-2xl ${i % 2 === 0 ? 'ml-auto bg-navy-50' : 'bg-gray-100'}`} />
                                        ))}
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center flex-col text-gray-400">
                                        <MessageCircle size={32} strokeWidth={1.5} className="mb-3 opacity-30" />
                                        <p className="font-medium text-sm">No hay mensajes anteriores</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 pb-4">
                                        {history.map(msg => {
                                            const isBot = msg.role === 'assistant';
                                            return (
                                                <div key={msg.id} className={`flex w-full ${isBot ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[75%] px-4 py-3 text-[14px] leading-relaxed relative shadow-sm ${isBot
                                                        ? 'bg-navy-900 text-white rounded-[20px] rounded-br-[4px]'
                                                        : 'bg-white border border-gray-100/80 text-navy-900 rounded-[20px] rounded-bl-[4px]'
                                                        }`}>
                                                        <p>{msg.content}</p>
                                                        <div className={`text-[10px] uppercase font-bold tracking-wider mt-2 ${isBot ? 'text-navy-300 text-right' : 'text-gray-400'}`}>
                                                            {new Date(msg.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                            <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-4">
                                <MessageCircle size={28} strokeWidth={1.5} className="text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-navy-900 tracking-tight">Tus conversaciones</h3>
                            <p className="text-sm font-medium mt-1">Selecciona un paciente para ver su historial</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
