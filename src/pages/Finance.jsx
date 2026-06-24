import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, LayoutDashboard, CheckCircle2, ArrowUpRight, ArrowDownRight, Package, Plus } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useFinance } from '../hooks/useFinance';
import { useSupplies } from '../hooks/useSupplies';
import { useServices } from '../hooks/useServices';
import FeatureLock from '../components/FeatureLock';
import FinanceSummary from '../components/Finance/FinanceSummary';
import PendingDeliveries from '../components/Finance/PendingDeliveries';
import IncomeSection from '../components/Finance/IncomeSection';
import ExpenseSection from '../components/Finance/ExpenseSection';
import SuppliesSection from '../components/Finance/SuppliesSection';
import RecordIncomeModal from '../components/Finance/RecordIncomeModal';
import RecordExpenseModal from '../components/Finance/RecordExpenseModal';

const PERIODS = [
    { key: 'day', label: 'Día' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
];

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function getNavLabel(period, date) {
    if (period === 'day') {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return `${days[date.getDay()]} ${date.getDate()}`;
    }
    if (period === 'week') return `Sem. ${getISOWeek(date)}`;
    const label = date.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

// Rango de datos del período seleccionado (KPIs, ingresos, egresos, desgloses)
function focusRange(period, anchor) {
    const y = anchor.getFullYear(), m = anchor.getMonth(), d = anchor.getDate();
    if (period === 'day') {
        return { start: new Date(y, m, d).toISOString(), end: new Date(y, m, d + 1).toISOString(), granularity: 'day' };
    }
    if (period === 'week') {
        const dow = anchor.getDay();
        const mon = new Date(anchor); mon.setDate(anchor.getDate() - dow + (dow === 0 ? -6 : 1)); mon.setHours(0, 0, 0, 0);
        const end = new Date(mon); end.setDate(mon.getDate() + 7);
        return { start: mon.toISOString(), end: end.toISOString(), granularity: 'day' };
    }
    return { start: new Date(y, m, 1).toISOString(), end: new Date(y, m + 1, 1).toISOString(), granularity: 'day' };
}

const TAB_DEFS = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'confirmar', label: 'Por confirmar', icon: CheckCircle2 },
    { id: 'ingresos', label: 'Ingresos', icon: ArrowUpRight },
    { id: 'egresos', label: 'Egresos', icon: ArrowDownRight },
    { id: 'insumos', label: 'Insumos', icon: Package },
];

// Botón "+" con texto al hover (como Agregar turno), aparece junto a los submódulos
function AddBtn({ label, onClick }) {
    return (
        <button onClick={onClick}
            className="relative overflow-hidden group h-10 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 rounded-full shadow-md hover:bg-white/60 transition-all duration-300">
            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
            <Plus size={16} className="shrink-0 relative z-10" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-[140px] transition-all duration-300 whitespace-nowrap text-[11px] font-bold relative z-10">{label}</span>
        </button>
    );
}

// Panel estilo Ofertas (solo para Insumos)
function SectionPanel({ children }) {
    return (
        <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md overflow-hidden p-4 animate-fade-up">
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="relative z-10">{children}</div>
        </div>
    );
}

export default function Finance() {
    const { canConfirmDelivery, canRecordIncome, canRecordExpense, canManageSupplies, canVoidFinance } = usePermissions();
    const [period, setPeriod] = useState('month');
    const [anchorDate, setAnchorDate] = useState(() => new Date());
    const [tab, setTab] = useState('resumen');
    const [incomeOpen, setIncomeOpen] = useState(false);
    const [expenseOpen, setExpenseOpen] = useState(false);

    const range = useMemo(() => focusRange(period, anchorDate), [period, anchorDate]);
    const fin = useFinance(range);
    const sup = useSupplies();
    const { services } = useServices();

    const navLabel = getNavLabel(period, anchorDate);
    const handlePeriodChange = (p) => { setPeriod(p); setAnchorDate(new Date()); };
    const handlePrev = () => setAnchorDate(prev => {
        const d = new Date(prev);
        if (period === 'day') d.setDate(d.getDate() - 1);
        if (period === 'week') d.setDate(d.getDate() - 7);
        if (period === 'month') d.setMonth(d.getMonth() - 1);
        return d;
    });
    const handleNext = () => setAnchorDate(prev => {
        const d = new Date(prev);
        if (period === 'day') d.setDate(d.getDate() + 1);
        if (period === 'week') d.setDate(d.getDate() + 7);
        if (period === 'month') d.setMonth(d.getMonth() + 1);
        return d;
    });

    const header = (
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
            <div>
                <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Finanzas</h1>
                <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Ingresos confirmados, costos reales y utilidad de tu negocio</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Selector de período */}
                <div className="relative overflow-hidden flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 text-[11px] font-bold text-navy-900 h-10">
                    <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(64,98,200,0.05)' }} />
                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(120,110,230,0.05)' }} />
                    {PERIODS.map(p => (
                        <button key={p.key} onClick={() => handlePeriodChange(p.key)}
                            className={`relative z-10 px-4 h-8 rounded-full transition-all ${period === p.key ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}>
                            {p.label}
                        </button>
                    ))}
                </div>
                {/* Navegador de fecha */}
                <div className="relative overflow-hidden flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 h-10">
                    <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(64,98,200,0.05)' }} />
                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(120,110,230,0.05)' }} />
                    <button onClick={handlePrev} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 backdrop-blur-sm border border-white/80 text-navy-900 hover:bg-white/80 shadow-md transition-all hover:scale-[1.05] active:scale-95"><ChevronLeft size={16} /></button>
                    <div className="relative z-10 h-8 flex items-center justify-center gap-1.5 px-3" style={{ minWidth: 110 }}>
                        <CalendarDays size={13} className="text-navy-900 shrink-0" />
                        <span className="text-[11px] font-bold text-navy-900 tracking-tight whitespace-nowrap leading-none capitalize">{navLabel}</span>
                    </div>
                    <button onClick={handleNext} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 backdrop-blur-sm border border-white/80 text-navy-900 hover:bg-white/80 shadow-md transition-all hover:scale-[1.05] active:scale-95"><ChevronRight size={16} /></button>
                </div>
                {/* Submódulos */}
                <div className="inline-flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 text-[11px] font-bold text-navy-900 h-10">
                    {TAB_DEFS.map(t => {
                        const Icon = t.icon;
                        return (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`relative z-10 px-3 h-8 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${tab === t.id ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}>
                                <Icon size={12} />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
                {/* Acción contextual del submódulo activo */}
                {tab === 'ingresos' && canRecordIncome && <AddBtn label="Registrar ingreso" onClick={() => setIncomeOpen(true)} />}
                {tab === 'egresos' && canRecordExpense && <AddBtn label="Registrar egreso" onClick={() => setExpenseOpen(true)} />}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col pt-2 px-2 overflow-hidden">
            {header}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-1">
                <FeatureLock feature="finance" variant="screen" title="Finanzas" description="El módulo financiero (ingresos, costos, insumos y reportes) está disponible en los planes Pro y Enterprise.">
                    {fin.loading && tab === 'resumen' ? (
                        <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-[3px] border-navy-100 border-t-navy-700 rounded-full animate-spin" /></div>
                    ) : tab === 'resumen' ? (
                        <FinanceSummary fin={fin} period={period} year={anchorDate.getFullYear()} month={anchorDate.getMonth()} day={anchorDate.getDate()} />
                    ) : tab === 'confirmar' ? (
                        <PendingDeliveries pending={fin.pending} canConfirm={canConfirmDelivery} onConfirm={fin.confirmDelivery} />
                    ) : tab === 'ingresos' ? (
                        <IncomeSection income={fin.income} canVoid={canVoidFinance} onVoid={fin.voidIncomeEntry} />
                    ) : tab === 'egresos' ? (
                        <ExpenseSection expenses={fin.expenses} canVoid={canVoidFinance} onVoid={fin.voidExpenseEntry} />
                    ) : (
                        <SectionPanel>
                            <SuppliesSection supplies={sup.supplies} services={services} canManage={canManageSupplies}
                                costForService={sup.costForService} create={sup.create} update={sup.update} toggle={sup.toggle} remove={sup.remove} onReload={sup.reload} />
                        </SectionPanel>
                    )}
                </FeatureLock>
            </div>

            {incomeOpen && <RecordIncomeModal onClose={() => setIncomeOpen(false)} onAdd={fin.addIncome} />}
            {expenseOpen && <RecordExpenseModal onClose={() => setExpenseOpen(false)} onAdd={fin.addExpense} />}
        </div>
    );
}
