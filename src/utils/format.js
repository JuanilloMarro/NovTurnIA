export function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = ('' + phone).replace(/\D/g, '');

    // Case 1: Full 11 digits starting with 502
    if (cleaned.startsWith('502') && cleaned.length === 11) {
        return `+502 ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    }

    // Case 2: 8 digits (assume Guatemala +502)
    if (cleaned.length === 8) {
        return `+502 ${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
    }

    // Default: just add + and group by 4
    if (cleaned.length > 3) {
        return `+${cleaned.slice(0, 3)} ${cleaned.slice(3).match(/.{1,4}/g)?.join(' ') || cleaned.slice(3)}`;
    }
    return `+${cleaned}`;
}
