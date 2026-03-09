export default function Badge({ status }) {
    const isConfirmed = status === 'confirmed';
    const isPending = status === 'pending';
    const isCancelled = status === 'cancelled';

    if (isConfirmed) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Confirmado
            </span>
        )
    }
    if (isPending) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pendiente
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Cancelado
        </span>
    )
}
