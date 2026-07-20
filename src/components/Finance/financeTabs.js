import { LayoutDashboard, CheckCircle2, ArrowUpRight, ArrowDownRight, HandCoins, Wallet, Users, Package, Settings2, Ticket } from 'lucide-react';

// Catálogo de submódulos de Finanzas — compartido entre el Sidebar (que ahora
// aloja la navegación como desplegable, ver Sidebar.jsx) y Finance.jsx (que
// lee el tab activo de la URL, ?tab=<id>). Única fuente de verdad para no
// desincronizar iconos/labels/orden entre los dos.
export const FINANCE_TABS = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'confirmar', label: 'Por confirmar', icon: CheckCircle2 },
    { id: 'ingresos', label: 'Ingresos', icon: ArrowUpRight },
    { id: 'egresos', label: 'Egresos', icon: ArrowDownRight },
    { id: 'cobrar', label: 'Por cobrar', icon: HandCoins },
    { id: 'vouchers', label: 'Vouchers', icon: Ticket },
    { id: 'caja', label: 'Caja', icon: Wallet },
    { id: 'produccion', label: 'Producción', icon: Users },
    { id: 'insumos', label: 'Inventario', icon: Package },
    { id: 'ajustes', label: 'Ajustes', icon: Settings2 },
];
