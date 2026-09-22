const PLUS_CODE_PATTERN = /\b[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,}\b\s*,?\s*/gi;

export function sanitizeReadableAddress(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const cleaned = value.replace(PLUS_CODE_PATTERN, '').replace(/^[,\s]+|[,\s]+$/g, '').trim();
  return cleaned || 'Ubicación seleccionada';
}

export function sanitizeAddressFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAddressFields(item)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result = { ...(value as Record<string, unknown>) };
  for (const [key, fieldValue] of Object.entries(result)) {
    if (typeof fieldValue === 'string' && key.toLowerCase().includes('address')) {
      result[key] = sanitizeReadableAddress(fieldValue);
    } else if (fieldValue && typeof fieldValue === 'object') {
      result[key] = sanitizeAddressFields(fieldValue);
    }
  }

  return result as T;
}
