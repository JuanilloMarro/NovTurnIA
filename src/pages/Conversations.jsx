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
        <div className="h-full flex flex-col max-w-4xl mx-auto w-full pt-2">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Conversaciones</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Atención directa vía WhatsApp</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-card flex overflow-hidden mb-4 lg:mb-6 animate-fade-up">
                {/* Left Panel: Contacts */}
                <div className="w-[320px] border-r border-white/40 flex flex-col bg-white/20 backdrop-blur-md z-10">
                    <div className="p-4 border-b border-white/40">
                        <div className="relative h-10 w-full">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-900">
                                <Search size={14} strokeWidth={2.5} />
                            </div>
                            <input
                                className="w-full h-full bg-white/60 backdrop-blur-card border border-white/90 rounded-full pl-10 pr-4 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-sm"
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
                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left group ${isSelected ? 'bg-white/60 border border-white/80 shadow-sm' : 'hover:bg-white/40 border border-transparent'}`}
                                >
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 border ${isSelected ? 'bg-navy-900 border-navy-900 text-white shadow-md' : 'bg-white border-white/60 text-navy-900 group-hover:bg-navy-900 group-hover:text-white group-hover:border-navy-900 shadow-sm'}`}>
                                        {getInitials(name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm truncate ${isSelected ? 'text-navy-900' : 'text-navy-900/80'}`}>{name}</div>
                                        <div className={`text-xs font-semibold tracking-wide truncate mt-0.5 ${isSelected ? 'text-navy-700' : 'text-navy-700/60'}`}>{formatPhone(p.id)}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Chat */}
                <div className="flex-1 flex flex-col relative bg-white/20 min-w-0">
                    {selectedPatient ? (
                        <>
                            {/* Chat Header */}
                            <div className="h-[72px] px-6 border-b border-white/40 flex items-center justify-between bg-white/30 backdrop-blur-md shrink-0 z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-full bg-white border border-white/60 flex items-center justify-center text-navy-900 text-xs font-bold shadow-sm">
                                        {getInitials(selectedPatient.display_name)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-navy-900 text-sm">{selectedPatient.display_name || 'Sin nombre'}</div>
                                        <div className="text-xs font-semibold text-navy-700/60 tracking-wide mt-0.5">{formatPhone(selectedPatient.id)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-transparent relative z-0">
                                {loadingHistory ? (
                                    <div className="flex justify-center flex-col gap-4">
                                        {Array(4).fill(0).map((_, i) => (
                                            <div key={i} className={`animate-shimmer h-12 w-3/4 rounded-2xl ${i % 2 === 0 ? 'ml-auto bg-white/60' : 'bg-white/40'}`} />
                                        ))}
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center flex-col text-navy-400">
                                        <MessageCircle size={32} strokeWidth={1.5} className="mb-3 opacity-30 text-navy-900" />
                                        <p className="font-bold text-sm text-navy-900/60">No hay mensajes anteriores</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 pb-4">
                                        {history.map(msg => {
                                            const isBot = msg.role === 'assistant';
                                            return (
                                                <div key={msg.id} className={`flex w-full ${isBot ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[75%] px-4 py-2.5 text-[13px] leading-relaxed relative shadow-sm font-medium ${isBot
                                                        ? 'bg-navy-900 text-white rounded-[20px] rounded-br-[4px] border border-navy-800'
                                                        : 'bg-white/70 backdrop-blur-md border border-white/90 text-navy-900 rounded-[20px] rounded-bl-[4px]'
                                                        }`}>
                                                        <p>{msg.content}</p>
                                                        <div className={`text-[9px] uppercase font-bold tracking-widest mt-1.5 ${isBot ? 'text-navy-300 text-right' : 'text-navy-500'}`}>
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
                        <div className="flex-1 flex flex-col items-center justify-center bg-transparent z-10">
                            <div className="w-16 h-16 rounded-full bg-white/40 backdrop-blur-md border border-white/60 shadow-sm flex items-center justify-center mb-4">
                                <MessageCircle size={28} strokeWidth={1.5} className="text-navy-900/60" />
                            </div>
                            <h3 className="text-lg font-bold text-navy-900 tracking-tight">Tus conversaciones</h3>
                            <p className="text-xs font-semibold text-navy-700/60 mt-1">Selecciona un paciente para ver su historial</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
