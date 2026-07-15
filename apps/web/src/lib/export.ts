export function downloadCsv(data: Record<string, any>[], filename: string) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const firstRow = data[0];
  if (!firstRow) {
    console.warn('No data to export');
    return;
  }

  const headers = Object.keys(firstRow);
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
        return val;
      })
      .join(','),
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
