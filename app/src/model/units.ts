import type { Units } from './types';

const CM_PER_INCH = 2.54;

/** A length for display, from centimetres. */
export function formatLength(cm: number, units: Units): string {
  if (units === 'imperial') {
    const totalIn = Math.round(cm / CM_PER_INCH);
    const ft = Math.floor(totalIn / 12);
    const inch = totalIn - ft * 12;
    if (ft === 0) return `${inch}″`;
    return inch === 0 ? `${ft}′` : `${ft}′ ${inch}″`;
  }
  if (Math.abs(cm) >= 100) return `${(cm / 100).toFixed(2).replace(/\.?0+$/, '')} m`;
  return `${Math.round(cm)} cm`;
}

/** An area for display, from cm². */
export function formatArea(cm2: number, units: Units): string {
  if (units === 'imperial') {
    const ft2 = cm2 / (CM_PER_INCH * 12) ** 2;
    return `${ft2.toFixed(1)} ft²`;
  }
  return `${(cm2 / 10000).toFixed(2)} m²`;
}

/** The number shown in an input field, in the field's display unit (cm or in). */
export function toField(cm: number, units: Units): number {
  if (units === 'imperial') return Math.round((cm / CM_PER_INCH) * 10) / 10;
  return Math.round(cm * 10) / 10;
}

export function fieldUnit(units: Units): string {
  return units === 'imperial' ? 'in' : 'cm';
}

/**
 * Parse what a person types into a length field, back to centimetres.
 * Accepts "250", "2.5m", "250 cm", "8'", "8' 2\"", "98in", "2,5 m".
 * Returns null when it cannot be read or is not positive.
 */
export function parseLength(input: string, units: Units): number | null {
  const s = input.trim().toLowerCase().replace(',', '.').replace(/[′’]/g, "'").replace(/[″”]/g, '"');
  if (!s) return null;
  const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/);
  if (ftIn) {
    const v = (parseFloat(ftIn[1]) * 12 + (ftIn[2] ? parseFloat(ftIn[2]) : 0)) * CM_PER_INCH;
    return v > 0 ? v : null;
  }
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m|in|"|)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  let cm: number;
  switch (m[2]) {
    case 'mm':
      cm = n / 10;
      break;
    case 'cm':
      cm = n;
      break;
    case 'm':
      cm = n * 100;
      break;
    case 'in':
    case '"':
      cm = n * CM_PER_INCH;
      break;
    default:
      cm = units === 'imperial' ? n * CM_PER_INCH : n;
  }
  return cm > 0 ? cm : null;
}
