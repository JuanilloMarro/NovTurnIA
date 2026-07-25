import { useState } from 'react';
import { CalendarPlus, MessageCircle, UserX, Repeat } from 'lucide-react';
import { PIPELINE_COLUMNS, HEALTH, dealHealth } from '../../hooks/usePipeline';
import { showErrorToast } from '../../store/useToastStore';
import DealCard from './DealCard';

const COL_THEMES = {
    booking: {
        icon: MessageCircle,
        iconBg: 'bg-amber-500/10',
        iconBorder: 'border-amber-500/20',
        iconText: 'text-amber-600',
        dot: 'bg-amber-500',
    },
    appointment: {
        icon: CalendarPlus,
        iconBg: 'bg-emerald-500/10',
        iconBorder: 'border-emerald-500/20',
        iconText: 'text-emerald-600',
        dot: 'bg-emerald-500',
    },
    recovery: {
        icon: UserX,
        iconBg: 'bg-rose-500/10',
        iconBorder: 'border-rose-500/20',
        iconText: 'text-rose-600',
        dot: 'bg-rose-500',
    },
    loyalty: {
        icon: Repeat,
        iconBg: 'bg-navy-500/10',
        iconBorder: 'border-navy-500/20',
        iconText: 'text-navy-500',
        dot: 'bg-navy-500',
    },
};

// Solo se puede arrastrar hacia "Cita programada", y eso ABRE el modal de
// agendar: la tarjeta se mueve porque se creó el turno de verdad (lo detecta el
// trigger de la DB), no porque hayamos escrito una etiqueta. El tablero refleja
// la realidad o no sirve.
const DROP_TARGET = 'appointment';

export default function PipelineBoard({
    byColumn, loading, onDealClick, onSchedule, canMove = true, canEditSteps = false, onToggleStep,
}) {
    const [draggingFrom, setDraggingFrom] = useState(null);

    const handleDragStart = (e, dealId) => {
        const from = Object.keys(byColumn).find(c => byColumn[c].some(d => d.deal_id === dealId));
        setDraggingFrom(from);
        e.dataTransfer.setData('dealId', dealId);
        e.dataTransfer.setData('fromColumn', from || '');
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            document.getElementById(`deal-card-${dealId}`)?.classList.add('opacity-30', 'scale-95');
        }, 0);
    };

    const handleDragEnd = (e, dealId) => {
        setDraggingFrom(null);
        document.getElementById(`deal-card-${dealId}`)?.classList.remove('opacity-30', 'scale-95');
    };

    const handleDragOver = (e) => { e.preventDefault(); e.currentTarget.classList.add('bg-white/60'); };
    const handleDragLeave = (e) => { e.currentTarget.classList.remove('bg-white/60'); };

    const handleDrop = (e, colId) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-white/60');
        setDraggingFrom(null);

        const dealId = e.dataTransfer.getData('dealId');
        const fromColumn = e.dataTransfer.getData('fromColumn');
        if (!dealId || fromColumn === colId) return;

        const deal = byColumn[fromColumn]?.find(d => d.deal_id === dealId);
        if (!deal) return;

        if (colId === DROP_TARGET) { onSchedule?.(deal); return; }

        showErrorToast(
            'Movimiento no permitido',
            'Esta fase la determina el estado real del turno. Arrastra a "Cita programada" para agendar.',
        );
    };

    return (
        <div className="flex-1 flex gap-3 overflow-x-auto custom-scrollbar min-h-0 pb-2">
            {PIPELINE_COLUMNS.map(col => {
                const theme = COL_THEMES[col.id];
                const Icon = theme.icon;
                const cards = byColumn[col.id] || [];
                const isTarget = canMove && draggingFrom && draggingFrom !== col.id && col.id === DROP_TARGET;

                // Resumen de salud de la columna: cuántos van bien vs. trabados
                const counts = cards.reduce((acc, d) => {
                    const h = dealHealth(d);
                    acc[h] = (acc[h] || 0) + 1;
                    return acc;
                }, {});

                return (
                    <div
                        key={col.id}
                        onDragOver={canMove ? handleDragOver : undefined}
                        onDragLeave={canMove ? handleDragLeave : undefined}
                        onDrop={canMove ? (e) => handleDrop(e, col.id) : undefined}
                        className={`relative flex-1 min-w-[260px] flex flex-col bg-white/40 backdrop-blur-2xl border rounded-[24px] shadow-md overflow-hidden transition-colors duration-300 ${isTarget ? 'border-emerald-300' : 'border-white/60'}`}
                    >
                        <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                        <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />

                        {/* Cabecera compacta */}
                        <div className="relative z-10 px-4 pt-4 pb-3 border-b border-white/40">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${theme.iconBg} border ${theme.iconBorder} ${theme.iconText}`}>
                                        <Icon size={13} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="font-bold text-navy-900 text-[12px] tracking-tight truncate">{col.title}</h3>
                                </div>
                                <span className="bg-white border border-white/80 text-navy-700 font-bold text-[10px] px-2 py-0.5 rounded-full shadow-sm shrink-0 tabular-nums flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                                    {cards.length}
                                </span>
                            </div>
                        </div>

                        <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-2">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="animate-shimmer h-[62px] rounded-2xl w-full" />
                                ))
                            ) : cards.length === 0 ? (
                                <div className="h-16 border-2 border-dashed border-white/60 rounded-2xl flex items-center justify-center text-navy-900/25 text-[10px] font-bold text-center px-3">
                                    {isTarget ? 'Soltar para agendar' : 'Sin clientes en esta fase'}
                                </div>
                            ) : (
                                cards.map(deal => (
                                    <DealCard
                                        key={deal.deal_id}
                                        deal={deal}
                                        column={col}
                                        draggable={canMove && col.id !== DROP_TARGET && col.id !== 'loyalty'}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                        onClick={onDealClick}
                                        canEditSteps={canEditSteps}
                                        onToggleStep={onToggleStep}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
