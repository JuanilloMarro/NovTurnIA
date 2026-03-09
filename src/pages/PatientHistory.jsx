import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePatients } from '../hooks/usePatients';
import { supabase, BUSINESS_ID } from '../config/supabase';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function PatientHistory() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { patients, search, handleSearch } = usePatients();
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const bottomRef = useRef(null);

    const selectedPatient = patients.find(p => p.id === id);

    useEffect(() => {
        if (id) {
            loadHistory(id);
        } else {
            setHistory([]);
        }
    }, [id]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    async function loadHistory(userId) {
        setLoadingHistory(true);
        try {
            const { data } = await supabase
                .from('conversation_history')
                .select('*')
                .eq('business_id', BUSINESS_ID)
                .eq('user_id', userId)
                .order('created_at', { ascending: true });
            setHistory(data || []);
        } finally {
            setLoadingHistory(false);
        }
    }

    return (
        <div className="h-full flex gap-6 mt-[-1rem]">
            {/* Panel izquierdo */}
            <div className="w-[30%] min-w-[300px] flex flex-col bg-white/80 backdrop-blur-card border border-white/90 rounded-2xl shadow-card overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                    <input
                        className="w-full bg-white/65 border border-navy-100/50 rounded-xl px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:bg-white focus:border-navy-500 focus:ring-2 focus:ring-navy-100 transition-all duration-200"
                        placeholder="Buscar en historial..."
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto">
                    {patients.map(p => {
                        const isSelected = p.id === id;
                        return (
                            <div
                                key={p.id}
                                className={`p-4 border-b border-gray-50 flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-navy-50' : 'hover:bg-gray-50'}`}
                                onClick={() => navigate(`/patients/${p.id}/history`)}
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-700 to-navy-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                    {getInitials(p.display_name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-navy-900 text-sm truncate">{p.display_name || `+${p.id}`}</div>
                                    <div className="text-xs text-gray-400 mt-0.5 truncate pr-2">Seleccionar para ver historial</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Panel derecho */}
            <div className="flex-1 flex flex-col bg-white/80 backdrop-blur-card border border-white/90 rounded-2xl shadow-card overflow-hidden relative">
                {selectedPatient ? (
                    <>
                        <div className="px-6 py-4 border-b border-gray-100 bg-white/90 backdrop-blur-md flex items-center gap-4 z-10 shadow-sm">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-700 to-navy-500 flex items-center justify-center text-white font-bold">
                                {getInitials(selectedPatient.display_name)}
                            </div>
                            <div>
                                <h2 className="font-bold text-navy-900 leading-tight">{selectedPatient.display_name || `+${selectedPatient.id}`}</h2>
                                <p className="text-xs text-navy-500">Historial de WhatsApp</p>
                            </div>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/50" style={{ backgroundImage: "url('https://i.pinimg.com/736x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')", backgroundBlendMode: 'overlay' }}>
                            {loadingHistory ? (
                                <div className="flex justify-center p-8 opacity-50 font-medium">Cargando mensajes...</div>
                            ) : history.length === 0 ? (
                                <div className="text-center text-gray-400 mt-20">No hay mensajes registrados con el bot.</div>
                            ) : (
                                history.map((msg) => {
                                    const isUser = msg.role === 'user';
                                    let content = msg.content;
                                    let hasAudio = false;
                                    if (content.match(/.*\[transcripción\].*/i)) {
                                        hasAudio = true;
                                    }

                                    return (
                                        <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-[14px] shadow-sm relative ${isUser
                                                    ? 'bg-navy-700 text-white rounded-br-sm shadow-navy-900/10'
                                                    : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100 shadow-gray-200/20'
                                                }`}>
                                                <div className="whitespace-pre-wrap leading-relaxed inline-block">
                                                    {hasAudio && <span className="mr-1">🎤</span>}
                                                    {content}
                                                </div>
                                                <div className={`text-[10px] mt-1 text-right flex justify-end min-w-[50px] ${isUser ? 'text-navy-200' : 'text-gray-400'}`}>
                                                    {new Date(msg.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={bottomRef} />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center space-y-4">
                        <div className="text-6xl opacity-30">💬</div>
                        <h3 className="font-semibold text-xl text-navy-900/50">Historial Conversacional</h3>
                        <p className="max-w-xs">Selecciona un paciente a la izquierda para ver su interacción completa con TurnIA Bot.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
