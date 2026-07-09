import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, LayoutDashboard, CheckCircle2, ArrowUpRight, ArrowDownRight, Package, Plus, Lock, Tags } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useFinance } from '../hooks/useFinance';
import { useSupplies } from '../hooks/useSupplies';
import { useServices } from '../hooks/useServices';
import FeatureLock from '../components/FeatureLock';
import { usePlanLimits } from '../hooks/usePlanLimits';
import FinanceSummary from '../components/Finance/FinanceSummary';
import PendingDeliveries from '../components/Finance/PendingDeliveries';
import PendingValidationDrawer from '../components/Finance/PendingValidationDrawer';
import IncomeSection from '../components/Finance/IncomeSection';
import ExpenseSection from '../components/Finance/ExpenseSection';
import SuppliesSection from '../components/Finance/SuppliesSection';
import RecordIncomeModal from '../components/Finance/RecordIncomeModal';
import RecordExpenseModal from '../components/Finance/RecordExpenseModal';
import FinanceDetailDrawer from '../components/Finance/FinanceDetailDrawer';
import CategoriesSection from '../components/Finance/CategoriesSection';

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
    { id: 'categorias', label: 'Categorías', icon: Tags },
];

// Datos de muestra para la vista previa del FeatureLock (plan Básico). Alimentan
// el MISMO componente FinanceSummary del módulo real — KPIs, gráficas (recharts) y
// desgloses — sin realizar ninguna llamada a la base de datos.
const MOCK_FIN = {
    totalIncome: 4850,
    totalExpenses: 1240,
    netProfit: 3610,
    marginPct: 74.4,
    summary: {
        income_by_method: [
            { method: 'cash', total: 2600, n: 18 },
            { method: 'card', total: 1500, n: 9 },
            { method: 'transfer', total: 750, n: 4 },
        ],
        expense_by_category: [
            { category: 'insumo', total: 620, n: 11 },
            { category: 'renta', total: 400, n: 1 },
            { category: 'servicios', total: 220, n: 3 },
        ],
        top_services: [
            { name: 'Corte Clásico', revenue: 1450 },
            { name: 'Tinte Completo', revenue: 1200 },
            { name: 'Manicure', revenue: 820 },
            { name: 'Barba y Corte', revenue: 680 },
            { name: 'Maquillaje', revenue: 500 },
        ],
    },
    trendPreview: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        .map((name, i) => ({
            name,
            income: [1200, 1800, 1500, 2200, 1900, 2600, 2400, 2100, 2800, 3100, 2700, 2900][i],
            expense: [400, 600, 500, 700, 650, 800, 750, 700, 900, 950, 820, 880][i],
        })),
};

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

export default function Finance() {
    const { canConfirmDelivery, canRecordIncome, canRecordExpense, canManageSupplies, canVoidFinance, canManageFinanceCategories } = usePermissions();
    const [period, setPeriod] = useState('month');
    const [anchorDate, setAnchorDate] = useState(() => new Date());
    const [tab, setTabRaw] = useState('resumen');
    const [incomeModal, setIncomeModal] = useState(null); // null | { initial }
    const [expenseModal, setExpenseModal] = useState(null);
    const [selectedEntry, setSelectedEntry] = useState(null); // { entry, type }
    const [selectedPending, setSelectedPending] = useState(null); // fila de "Por confirmar"
    const [categoryKind, setCategoryKind] = useState('income');

    const setTab = (t) => { setTabRaw(t); setSelectedEntry(null); setSelectedPending(null); };

    const range = useMemo(() => focusRange(period, anchorDate), [period, anchorDate]);
    const fin = useFinance(range);
    const sup = useSupplies();
    const { services } = useServices();
    const { hasFeature: hasPlanFeature, isLoading: planLoading } = usePlanLimits();
    const suppliesUnlocked = hasPlanFeature('supplies');

    const navLabel = getNavLabel(period, anchorDate);
    const showCalendar = tab === 'resumen';
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
                {/* Calendario — solo en Resumen */}
                {showCalendar && (
                    <>
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
                    </>
                )}
                {/* Submódulos — scroll horizontal en pantallas angostas para no recortar tabs */}
                <div className="inline-flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 text-[11px] font-bold text-navy-900 h-10 max-w-full overflow-x-auto no-scrollbar">
                    {TAB_DEFS.map(t => {
                        const Icon = t.icon;
                        return (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`relative z-10 shrink-0 px-3 h-8 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${tab === t.id ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}>
                                <Icon size={12} />
                                {t.label}
                                {t.id === 'insumos' && !suppliesUnlocked && <Lock size={10} className="text-navy-700/50" />}
                            </button>
                        );
                    })}
                </div>
                {/* Acción contextual */}
                {tab === 'ingresos' && canRecordIncome && <AddBtn label="Registrar ingreso" onClick={() => setIncomeModal({ initial: null })} />}
                {tab === 'egresos' && canRecordExpense && <AddBtn label="Registrar egreso" onClick={() => setExpenseModal({ initial: null })} />}
                {tab === 'categorias' && (
                    <div className="relative overflow-hidden flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 text-[11px] font-bold text-navy-900 h-10">
                        <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(64,98,200,0.05)' }} />
                        <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(120,110,230,0.05)' }} />
                        <button onClick={() => setCategoryKind('income')}
                            className={`relative z-10 px-3 h-8 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${categoryKind === 'income' ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}>
                            <ArrowUpRight size={12} className="shrink-0" />
                            Ingresos
                        </button>
                        <button onClick={() => setCategoryKind('expense')}
                            className={`relative z-10 px-3 h-8 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${categoryKind === 'expense' ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}>
                            <ArrowDownRight size={12} className="shrink-0" />
                            Egresos
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const scrollList = (node) => <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 py-2">{node}</div>;

    if (!planLoading && !hasPlanFeature('finance')) {
        return (
            <FeatureLock
                feature="finance"
                variant="blurred"
                title="Finanzas"
                description="El módulo financiero (ingresos, costos, insumos y reportes) está disponible en los planes Pro y Enterprise."
                requiredPlan="Pro"
            >
                <div className="h-full flex flex-col pt-2 px-2">
                    {/* Header mock */}
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                        <div>
                            <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Finanzas</h1>
                            <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Ingresos confirmados, costos reales y utilidad de tu negocio</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            <div className="relative overflow-hidden flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 text-[11px] font-bold text-navy-900 h-10">
                                <div className="px-4 h-8 rounded-full bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900 flex items-center">Mes</div>
                            </div>
                            <div className="relative overflow-hidden flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 h-10">
                                <div className="w-8 h-8 rounded-full bg-white/60 backdrop-blur-sm border border-white/80 flex items-center justify-center"><ChevronLeft size={16} className="text-navy-900" /></div>
                                <div className="h-8 flex items-center gap-1.5 px-3" style={{ minWidth: 110 }}><CalendarDays size={13} className="text-navy-900 shrink-0" /><span className="text-[11px] font-bold text-navy-900 capitalize">Junio 2026</span></div>
                                <div className="w-8 h-8 rounded-full bg-white/60 backdrop-blur-sm border border-white/80 flex items-center justify-center"><ChevronRight size={16} className="text-navy-900" /></div>
                            </div>
                            <div className="inline-flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 text-[11px] font-bold h-10">
                                {TAB_DEFS.map((t, i) => {
                                    const Icon = t.icon;
                                    return (
                                        <div key={t.id} className={`px-3 h-8 rounded-full flex items-center gap-1.5 whitespace-nowrap ${i === 0 ? 'bg-white/60 text-navy-900' : 'text-navy-900/60'}`}>
                                            <Icon size={12} />{t.label}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    {/* Resumen real (mismo componente del módulo) alimentado con datos de muestra */}
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 py-2">
                        <FinanceSummary fin={MOCK_FIN} period="month" year={anchorDate.getFullYear()} month={anchorDate.getMonth()} day={anchorDate.getDate()} />
                    </div>
                </div>
            </FeatureLock>
        );
    }

    return (
        <div className={`relative h-full flex flex-col pt-2 px-2 transition-all duration-300 ${(selectedEntry || selectedPending) ? 'sm:pr-[388px]' : ''}`}>
            {header}
            <div className="flex-1 min-h-0 flex flex-col">
                <FeatureLock feature="finance" variant="screen" title="Finanzas" description="El módulo financiero (ingresos, costos, insumos y reportes) está disponible en los planes Pro y Enterprise.">
                    <div className="h-full flex flex-col min-h-0">
                        {fin.loading && tab === 'resumen' ? (
                            <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-[3px] border-navy-100 border-t-navy-700 rounded-full animate-spin" /></div>
                        ) : tab === 'resumen' ? (
                            scrollList(<FinanceSummary fin={fin} period={period} year={anchorDate.getFullYear()} month={anchorDate.getMonth()} day={anchorDate.getDate()} />)
                        ) : tab === 'confirmar' ? (
                            scrollList(<PendingDeliveries pending={fin.pending} onSelect={setSelectedPending} selectedId={selectedPending?.id} />)
                        ) : tab === 'ingresos' ? (
                            scrollList(<IncomeSection income={fin.income} onSelect={e => setSelectedEntry({ entry: e, type: 'income' })} selectedId={selectedEntry?.type === 'income' ? selectedEntry.entry.id : null} />)
                        ) : tab === 'egresos' ? (
                            scrollList(<ExpenseSection expenses={fin.expenses} onSelect={e => setSelectedEntry({ entry: e, type: 'expense' })} selectedId={selectedEntry?.type === 'expense' ? selectedEntry.entry.id : null} />)
                        ) : tab === 'insumos' ? (
                            // Insumos — dos paneles (Insumos / Recetas) lado a lado
                            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar px-2 py-2">
                                <FeatureLock feature="supplies" variant="blurred" title="Insumos y Recetas" description="El catálogo de insumos y el cálculo de costo real por servicio están disponibles en el plan Enterprise." requiredPlan="Enterprise">
                                    <SuppliesSection supplies={sup.supplies} services={services} canManage={canManageSupplies}
                                        costForService={sup.costForService} create={sup.create} update={sup.update} remove={sup.remove} onReload={sup.reload} />
                                </FeatureLock>
                            </div>
                        ) : (
                            // Categorías — panel dividido (lista + form), mismo patrón que Servicios
                            <div className="flex-1 min-h-0 overflow-hidden px-2 py-2">
                                <div className="mx-auto w-full max-w-[1080px] h-full">
                                    <CategoriesSection canManage={canManageFinanceCategories} activeKind={categoryKind} setActiveKind={setCategoryKind} />
                                </div>
                            </div>
                        )}
                    </div>
                </FeatureLock>
            </div>

            {selectedEntry && (
                <FinanceDetailDrawer
                    entry={selectedEntry.entry}
                    type={selectedEntry.type}
                    canVoid={canVoidFinance}
                    canEdit={selectedEntry.type === 'income' ? canRecordIncome : canRecordExpense}
                    onEdit={(e) => selectedEntry.type === 'income' ? setIncomeModal({ initial: e }) : setExpenseModal({ initial: e })}
                    onClose={() => setSelectedEntry(null)}
                    onVoid={selectedEntry.type === 'income' ? fin.voidIncomeEntry : fin.voidExpenseEntry}
                />
            )}

            {selectedPending && (
                <PendingValidationDrawer
                    entry={selectedPending}
                    canConfirm={canConfirmDelivery}
                    canVoid={canVoidFinance}
                    onConfirm={fin.confirmValidation}
                    onVoid={fin.voidIncomeEntry}
                    onClose={() => setSelectedPending(null)}
                />
            )}

            {incomeModal && (
                <RecordIncomeModal
                    initial={incomeModal.initial}
                    onClose={() => setIncomeModal(null)}
                    onSubmit={async (fields) => {
                        if (incomeModal.initial) {
                            const updated = await fin.updateIncomeEntry(incomeModal.initial.id, fields);
                            setSelectedEntry(sel => (sel ? { entry: updated, type: 'income' } : sel));
                        } else {
                            await fin.addIncome(fields);
                        }
                    }}
                />
            )}
            {expenseModal && (
                <RecordExpenseModal
                    initial={expenseModal.initial}
                    onClose={() => setExpenseModal(null)}
                    onSubmit={async (fields) => {
                        if (expenseModal.initial) {
                            const updated = await fin.updateExpenseEntry(expenseModal.initial.id, fields);
                            setSelectedEntry(sel => (sel ? { entry: updated, type: 'expense' } : sel));
                        } else {
                            await fin.addExpense(fields);
                        }
                    }}
                />
            )}
        </div>
    );
}
