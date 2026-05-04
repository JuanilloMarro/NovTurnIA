import { useState } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { usePlanLimits } from '../hooks/usePlanLimits';
import FollowUpList from '../components/Calendar/FollowUpList';
import AppointmentDrawer from '../components/Calendar/AppointmentDrawer';
import FeatureLock from '../components/FeatureLock';
import { RefreshCw, SlidersHorizontal, Lock, UserX, X as XIcon, ChevronRight, ChevronLeft, Phone, Calendar as CalendarIcon, Clock, Tag, RotateCcw, MessageCircle, Trash2 } from 'lucide-react';

const MOCK_FOLLOWUP = [
    { id:1,  name:'María González',   service:'Corte de Cabello', date:'28 Abr 2025',  time:'10:00 am', phone:'+502 5555-1234', status:'no_show'   },
    { id:2,  name:'Carlos Pérez',     service:'Tinte Completo',   date:'26 Abr 2025',  time:'02:00 pm', phone:'+502 5555-5678', status:'cancelled' },
    { id:3,  name:'Ana López',        service:'Manicure',         date:'23 Abr 2025',  time:'11:30 am', phone:'+502 5555-9012', status:'no_show'   },
    { id:4,  name:'Luis Ramírez',     service:'Barba y Corte',    date:'19 Abr 2025',  time:'09:00 am', phone:'+502 5555-3456', status:'cancelled' },
    { id:5,  name:'Sandra Torres',    service:'Maquillaje',       date:'15 Abr 2025',  time:'03:00 pm', phone:'+502 5555-7890', status:'no_show'   },
    { id:6,  name:'Roberto Díaz',     service:'Corte Clásico',    date:'14 Abr 2025',  time:'08:30 am', phone:'+502 5555-2345', status:'cancelled' },
    { id:7,  name:'Fernanda Méndez',  service:'Manicure',         date:'12 Abr 2025',  time:'04:00 pm', phone:'+502 5555-6789', status:'no_show'   },
    { id:8,  name:'Jorge Castillo',   service:'Barba y Corte',    date:'10 Abr 2025',  time:'10:30 am', phone:'+502 5555-0123', status:'cancelled' },
    { id:9,  name:'Valeria Morales',  service:'Tinte Completo',   date:'8 Abr 2025',   time:'01:00 pm', phone:'+502 5555-4567', status:'no_show'   },
    { id:10, name:'Diego Herrera',    service:'Corte de Cabello', date:'5 Abr 2025',   time:'09:30 am', phone:'+502 5555-8901', status:'cancelled' },
];

const TYPE_OPTIONS = [
    { value: 'all',       label: 'Todos' },
    { value: 'no_show',   label: 'No se presentó' },
    { value: 'cancelled', label: 'Cancelados' },
];

const DAYS_OPTIONS = [
    { value: 7,  label: '7 días' },
    { value: 30, label: '30 días' },
    { value: 60, label: '60 días' },
    { value: 90, label: '90 días' },
];

export default function FollowUp() {
    const { canViewFollowUp } = usePermissions();
    const { hasFeature } = usePlanLimits();
    const followUpUnlocked = hasFeature('followup');

    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [followUpType, setFollowUpType] = useState('all');
    const [followUpDays, setFollowUpDays] = useState(30);
    const [showFollowUpFilters, setShowFollowUpFilters] = useState(false);
    const [followUpReloadKey, setFollowUpReloadKey] = useState(0);
    const [followUpLoading, setFollowUpLoading] = useState(false);

    const hasActiveFilters = followUpType !== 'all' || followUpDays !== 30;

    if (!canViewFollowUp) {
        return (
            <div className="h-full flex items-center justify-center p-8 text-center animate-fade-in">
                <div className="max-w-md w-full bg-white/40 backdrop-blur-2xl rounded-[32px] p-8 border border-white/60 shadow-[0_8px_32px_rgba(26,58,107,0.04)] flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-navy-900/5 flex items-center justify-center mb-6">
                        <Lock className="text-navy-400" size={32} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-bold text-navy-900 mb-2">Acceso Restringido</h3>
                    <p className="text-sm text-navy-700/60 leading-relaxed font-semibold">
                        No tienes permisos para acceder al seguimiento de pacientes.
                    </p>
                </div>
            </div>
        );
    }

    if (!followUpUnlocked) {
        return (
            <FeatureLock
                feature="followup"
                variant="blurred"
                title="Seguimiento de Clientes"
                description="Recuperá clientes con no-show o cancelaciones y reagendalos desde un solo panel. Disponible en Pro y Enterprise."
                requiredPlan="Pro"
            >
                {/* Replica el módulo real: lista + drawer de detalle abierto */}
                <div className={`h-full flex flex-col w-full pt-2 sm:pr-[380px] px-2 sm:px-0`}>
                    <div className="flex items-center justify-between gap-3 mb-4 px-2">
                        <div>
                            <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Seguimiento</h1>
                            <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Vista previa del plan Pro</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-10 w-28 bg-white/60 backdrop-blur-card border border-white/90 rounded-full shadow-sm" />
                            <div className="h-10 w-24 bg-white/60 backdrop-blur-card border border-white/90 rounded-full shadow-sm" />
                        </div>
                    </div>
                    {/* Lista de clientes */}
                    <div className="flex-1 overflow-hidden pt-2 space-y-2 px-2">
                        {MOCK_FOLLOWUP.map((row) => {
                            const isCancelled = row.status === 'cancelled';
                            const iconBg = isCancelled ? 'bg-rose-500/10 text-rose-700 border-rose-500/20' : 'bg-gray-100 text-gray-500 border-gray-200';
                            const Icon = isCancelled ? XIcon : UserX;
                            return (
                                <div key={row.id} className="bg-white/40 backdrop-blur-sm border border-white/60 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
                                    <div className="flex items-center gap-3.5">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${iconBg}`}>
                                            <Icon size={16} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold text-navy-900 leading-snug">
                                                <span className="font-bold text-navy-900/60 text-[10px] tracking-wider block mb-0.5">{isCancelled ? 'Cancelado' : 'No se presentó'}</span>
                                                {row.name}
                                            </p>
                                            <div className="flex items-center mt-1 text-[10px] font-bold text-navy-900/40 tracking-wider">
                                                <span>{row.date}</span><span className="mx-1.5 opacity-60">•</span>
                                                <span>{row.time}</span><span className="mx-1.5 opacity-60">•</span>
                                                <span>{row.phone}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-navy-700/30 shrink-0" />
                                </div>
                            );
                        })}
                    </div>
                </div>
                {/* Drawer de detalle — como se ve cuando hay un turno seleccionado */}
                <div className="absolute top-2 right-2 bottom-2 w-[360px] bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] flex-col hidden sm:flex overflow-hidden">
                    <div className="flex items-center gap-2 p-4">
                        <div className="w-7 h-7 rounded-full bg-white/40 border border-white/50 flex items-center justify-center"><ChevronLeft size={16} className="text-navy-700" /></div>
                        <h3 className="flex-1 font-bold text-navy-900 text-sm text-center">Detalle del turno</h3>
                        <div className="w-7 h-7" />
                    </div>
                    <div className="flex-1 overflow-hidden px-5 py-4 flex flex-col justify-between">
                        <div>
                            {/* Hero cliente */}
                            <div className="flex items-center gap-3 mb-6 px-1">
                                <div className="w-12 h-12 rounded-full bg-navy-900 flex items-center justify-center text-white text-base font-bold border border-white/20 shadow-md">MG</div>
                                <div>
                                    <div className="font-bold text-navy-900 text-base">María González</div>
                                    <div className="mt-1 flex items-center gap-1.5 text-navy-700/50 font-semibold text-[11px]">
                                        <Phone size={11} className="opacity-40" />+502 5555-1234
                                    </div>
                                    <div className="mt-2">
                                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 border border-gray-200 px-2 py-[2px] rounded-md text-[9px] font-bold">
                                            <UserX size={9} strokeWidth={3} />Ausente
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* Sección fecha y hora */}
                            <div className="space-y-6 px-1">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <h4 className="text-[11px] font-bold text-navy-800">Fecha y hora</h4>
                                        <div className="flex-1 h-px bg-navy-900/10" />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center shrink-0"><CalendarIcon size={18} /></div>
                                            <div className="pt-0.5">
                                                <div className="text-xs font-semibold text-gray-400 mb-0.5">Fecha</div>
                                                <div className="font-bold text-navy-900 text-xs">Lunes, 28 de abril de 2025</div>
                                            </div>
                                        </div>
                                        <div className="border-b border-dashed border-gray-200 ml-14" />
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center shrink-0"><Clock size={18} /></div>
                                            <div className="pt-0.5">
                                                <div className="text-xs font-semibold text-gray-400 mb-0.5">Horario</div>
                                                <div className="font-bold text-navy-900 text-xs">10:00 am — 10:30 am</div>
                                            </div>
                                        </div>
                                        <div className="border-b border-dashed border-gray-200 ml-14" />
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center shrink-0"><Tag size={18} /></div>
                                            <div className="pt-0.5">
                                                <div className="text-xs font-semibold text-gray-400 mb-0.5">Servicio</div>
                                                <div className="font-bold text-navy-900 text-xs">Corte de Cabello · 30 min · Q80.00</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Footer acciones */}
                    <div className="p-4 mt-auto">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {[{ icon: RotateCcw, label:'Reagendar', cls:'bg-white border-white/80 text-navy-900' }, { icon: MessageCircle, label:'Chat', cls:'bg-white border-white/80 text-navy-900' }, { icon: Trash2, label:'Eliminar', cls:'bg-white border-white/80 text-rose-600' }].map(({ icon: Icon, label, cls }) => (
                                <div key={label} className={`group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white border border-white/80 text-navy-900 text-[11px] font-bold rounded-full shadow-card hover:bg-white/80 transition-all duration-300 overflow-hidden ${cls}`}>
                                    <Icon size={14} className="shrink-0" />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap ml-0">
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </FeatureLock>
        );
    }

    return (
        <div className={`h-full flex flex-col w-full pt-2 relative transition-all duration-300 ${selectedAppointment ? 'sm:pr-[380px] px-2 sm:px-0' : 'px-4'}`}>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Seguimiento</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Recuperación de pacientes y re-agendamiento</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto justify-start lg:justify-end overflow-x-auto lg:overflow-visible">
                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 shadow-sm h-10">
                        <button
                            onClick={() => setFollowUpReloadKey(k => k + 1)}
                            disabled={followUpLoading}
                            className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 active:scale-95 transition-all duration-300 overflow-hidden disabled:opacity-40"
                        >
                            <RefreshCw size={14} className={`shrink-0 ${followUpLoading ? 'animate-spin' : ''}`} />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap">Actualizar</span>
                        </button>
                    </div>
                    <div className="relative">
                        <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-10 shadow-sm">
                            <button
                                onClick={() => setShowFollowUpFilters(v => !v)}
                                className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 transition-all duration-300 overflow-hidden outline-none"
                            >
                                <SlidersHorizontal size={14} className="shrink-0" />
                                <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap">Filtros</span>
                            </button>
                        </div>

                        {showFollowUpFilters && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-3xl shadow-[0_8px_32px_rgba(26,58,107,0.16),0_2px_8px_rgba(0,0,0,0.06)] z-50 p-2 animate-fade-up">
                                {hasActiveFilters && (
                                    <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-gray-100">
                                        <span className="text-[10px] font-bold text-navy-700/50 tracking-wide">Filtros</span>
                                        <button onClick={() => { setFollowUpType('all'); setFollowUpDays(30); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-600">Limpiar</button>
                                    </div>
                                )}
                                <p className="px-2 pt-2 pb-1 text-[10px] font-bold text-navy-700/40 tracking-wide">Estado</p>
                                {TYPE_OPTIONS.map(opt => (
                                    <div
                                        key={opt.value}
                                        onClick={() => setFollowUpType(opt.value)}
                                        className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${followUpType === opt.value ? 'bg-white border-white shadow-[0_4px_14px_rgba(0,0,0,0.09)] text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-gray-50'}`}
                                    >
                                        {opt.label}
                                    </div>
                                ))}
                                <div className="border-t border-gray-100 mt-1 pt-1">
                                    <p className="px-2 pt-1 pb-1 text-[10px] font-bold text-navy-700/40 tracking-wide">Período</p>
                                    {DAYS_OPTIONS.map(opt => (
                                        <div
                                            key={opt.value}
                                            onClick={() => setFollowUpDays(opt.value)}
                                            className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${followUpDays === opt.value ? 'bg-white border-white shadow-[0_4px_14px_rgba(0,0,0,0.09)] text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-gray-50'}`}
                                        >
                                            {opt.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 relative min-h-0 overflow-hidden rounded-[24px]">
                <FollowUpList
                    type={followUpType}
                    days={followUpDays}
                    reloadKey={followUpReloadKey}
                    onAppointmentSelected={setSelectedAppointment}
                    onLoadingChange={setFollowUpLoading}
                />
            </div>

            {selectedAppointment && (
                <AppointmentDrawer
                    appointment={selectedAppointment}
                    variant="followup"
                    onClose={() => setSelectedAppointment(null)}
                    onUpdated={() => {
                        setFollowUpReloadKey(k => k + 1);
                    }}
                />
            )}
        </div>
    );
}
