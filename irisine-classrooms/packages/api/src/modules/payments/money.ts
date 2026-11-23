/**
 * Money is handled as integer paise everywhere. Floats only appear at the
 * boundary with the existing Float columns, and are rounded once.
 */
export function rupeesToPaise(value: number | string): number {
  if (typeof value === 'string') {
    const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
    if (!m) throw new Error('Invalid amount');
    return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
  }
  return Math.round(value * 100);
}

export function paiseToRupees(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, '0')}`;
}
