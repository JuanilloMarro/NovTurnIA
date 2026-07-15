import { StrictMode, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Send, Search, RefreshCw, Clock, FileText, Target, HeartPulse, TrendingUp } from 'lucide-react';
import AIStar from './components/Icons/AIStar';
import './index.css';

const FAKE_MESSAGES = [
    { role: 'user', text: '¿A quién debería contactar esta semana?', created_at: new Date().toISOString() },
    { role: 'assistant', text: 'Tenés 4 clientes en riesgo de abandono. María López no ha vuelto en 52 días y tiene 6 visitas previas — sería la prioridad más alta para contactar hoy.', created_at: new Date().toISOString() },
];

const FAKE_ACTIONS = [
    { title: 'Resumen de cliente', desc: 'Seguimiento e historial resumido.', icon: FileText, mode: 'A pedido' },
    { title: 'Estrategia por cliente', desc: 'Acción sugerida y borrador.', icon: Target, mode: 'A pedido' },
    { title: 'Retención y riesgo', desc: 'Clientes en riesgo de abandono.', icon: HeartPulse, mode: 'Semanal' },
    { title: 'KPIs explicados', desc: 'El porqué detrás de tus números.', icon: TrendingUp, mode: 'A pedido' },
];

const FAKE_ACTIVITY = [
    { title: 'Semana estable: ingresos +8%', meta: 'Digest semanal · hace 2 h', icon: Clock },
    { title: '4 clientes en riesgo de abandono', meta: 'Retención · hace 1 día', icon: HeartPulse },
    { title: 'El martes es tu día más fuerte', meta: 'KPIs · hace 2 días', icon: TrendingUp },
];

function Glows() {
    return (
        <>
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
        </>
    );
}

function ChatPanel() {
    const scrollRef = useRef(null);
    useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, []);
    return (
        <div className="flex-[3] min-w-0 flex min-h-0">
            <div className="relative flex-1 min-w-0 flex flex-col min-h-0 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md overflow-hidden">
                <Glows />
                <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-navy-900 tracking-tight"><AIStar size={12} /> Chat de negocio</span>
                    <button className="text-[9px] font-bold text-navy-700/50">Limpiar</button>
                </div>
                <div ref={scrollRef} className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 space-y-3">
                    {FAKE_MESSAGES.map((m, i) => {
                        const isOut = m.role === 'user';
                        return (
                            <div key={i} className={`flex w-full ${isOut ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[88%] relative overflow-hidden px-4 py-2.5 text-[12px] leading-relaxed font-medium shadow-sm rounded-[20px] ${isOut ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'} bg-white/50 border border-white/60 text-navy-900`}>
                                    <p className="whitespace-pre-wrap">{m.text}</p>
                                    <div className={`text-[8px] uppercase font-bold tracking-widest mt-1.5 flex items-center gap-1 text-navy-900/40 ${isOut ? 'justify-end' : ''}`}>
                                        {isOut ? <span>Tú</span> : <span>IA</span>}
                                        <span>10:24 AM</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <form className="relative z-10 shrink-0 px-5 pt-3 pb-5">
                    <div className="relative flex items-center gap-2 bg-white/50 border border-white/60 rounded-full pl-4 pr-1.5 py-1.5 shadow-md">
                        <AIStar size={14} className="text-navy-900/50 shrink-0" />
                        <input placeholder="Pregúntale a tu negocio..." readOnly className="flex-1 min-w-0 bg-transparent text-[12px] font-semibold text-navy-900 outline-none placeholder-navy-700/40" />
                        <button type="button" className="w-8 h-8 rounded-full bg-navy-900 border border-white/10 flex items-center justify-center text-white shrink-0"><Send size={13} /></button>
                    </div>
                    <p className="text-center text-[8px] font-bold text-navy-900/25 mt-1.5">Cada pregunta consume IA</p>
                </form>
            </div>
        </div>
    );
}

function InsightsPanel() {
    return (
        <div className="flex-[5] min-w-0 flex min-h-0">
            <div className="relative flex-1 min-w-0 flex flex-col min-h-0 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md overflow-hidden">
                <Glows />
                <div className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-4">
                    <div className="shrink-0 flex flex-col items-center text-center">
                        <div className="relative w-[387px] max-w-full h-[220px] -mb-2 flex items-center justify-center text-navy-900/20 text-xs border border-dashed border-navy-900/10 rounded-full">[orbe]</div>
                        <h2 className="text-lg sm:text-xl font-bold text-navy-900 tracking-tight leading-none">Hola, Doc</h2>
                        <p className="text-[9.5px] font-semibold text-navy-700/55 mt-1 max-w-md leading-none whitespace-nowrap">Análisis y estrategias de tu negocio, verlos después no gasta IA</p>
                    </div>
                    <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {FAKE_ACTIONS.map((action, i) => (
                            <div key={i} className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-md p-2.5 text-left flex flex-col gap-1.5">
                                <div className="relative z-10 flex items-center justify-between">
                                    <div className="w-7 h-7 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shadow-inner"><action.icon size={13} className="text-navy-900" /></div>
                                    <span className="px-1.5 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10 text-[7px] font-bold uppercase tracking-widest text-navy-900/30">{action.mode}</span>
                                </div>
                                <div className="relative z-10">
                                    <p className="text-[11px] font-semibold text-navy-900 tracking-tight leading-none">{action.title}</p>
                                    <p className="text-[9px] font-semibold text-navy-700/55 leading-snug mt-1 line-clamp-2">{action.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ActivityPanel() {
    return (
        <div className="flex-[2] min-w-0 flex min-h-0">
            <div className="relative flex-1 min-w-0 flex flex-col min-h-0 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md overflow-hidden">
                <Glows />
                <div className="relative z-10 flex items-center gap-2.5 px-5 pt-5 pb-3">
                    <div className="w-8 h-8 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0"><Clock size={14} className="text-navy-900" /></div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[12px] font-bold text-navy-900 tracking-tight leading-none">Actividad reciente</h3>
                        <p className="text-[9px] font-bold text-navy-900/40 mt-1 leading-none">Análisis guardados · verlos es gratis</p>
                    </div>
                    <button className="w-7 h-7 rounded-full bg-white/40 border border-white/60 flex items-center justify-center text-navy-700/60 shadow-sm shrink-0"><RefreshCw size={12} /></button>
                </div>
                <div className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 pb-2">
                    <div className="space-y-1.5 py-1">
                        {FAKE_ACTIVITY.map((item, i) => (
                            <button key={i} className="w-full flex items-start gap-3 px-3 py-2.5 rounded-2xl text-left border border-transparent hover:bg-white/50">
                                <div className="w-8 h-8 rounded-xl bg-white/60 border border-white/70 flex items-center justify-center shrink-0 shadow-sm mt-0.5"><item.icon size={14} className="text-navy-900" /></div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11.5px] font-bold text-navy-900 leading-snug line-clamp-2">{item.title}</p>
                                    <p className="text-[9px] font-bold text-navy-900/35 mt-0.5">{item.meta}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="relative z-10 px-4 pb-4 pt-2 shrink-0">
                    <div className="relative">
                        <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-700/40 pointer-events-none" />
                        <input placeholder="Buscar un análisis..." readOnly className="w-full bg-white/50 border border-white/60 rounded-full pl-8 pr-3 py-2 text-[11px] font-semibold text-navy-900 outline-none shadow-sm placeholder-navy-700/40" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function Preview() {
    return (
        <div style={{ height: '100vh', width: '100vw', background: '#eef2fb', display: 'flex', padding: 16, gap: 16 }}>
            <ChatPanel />
            <InsightsPanel />
            <ActivityPanel />
        </div>
    );
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <Preview />
    </StrictMode>
);
