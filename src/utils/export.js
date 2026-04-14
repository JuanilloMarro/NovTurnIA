/**
 * Generates and triggers a CSV download in the browser.
 * Adds BOM (U+FEFF) so Excel opens non-ASCII characters correctly.
 *
 * @param {Object[]} rows  - Array of flat objects (same keys on every row)
 * @param {string}   filename - Desired file name, e.g. "pacientes.csv"
 */
export function downloadCSV(rows, filename) {
    if (!rows || rows.length === 0) return;

    const headers = Object.keys(rows[0]);

    const escape = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return /[,\n"]/.test(str) ? `"${str}"` : str;
    };

    const csv = [
        headers.join(','),
        ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
