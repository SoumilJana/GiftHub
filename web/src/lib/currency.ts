/**
 * Currency handling.
 *
 * - Each item keeps the currency of the store it came from (amazon.in -> INR).
 * - Each user has a preferred currency, used for manual entry and stores whose
 *   domain doesn't say (.com). It is detected on first visit and the user can
 *   change it in their profile.
 */

/** Country-code domain endings that reliably mean one currency. Longest match wins. */
const DOMAIN_CURRENCY: Record<string, string> = {
  'in': 'INR',
  'co.in': 'INR',
  'uk': 'GBP',
  'co.uk': 'GBP',
  'de': 'EUR',
  'fr': 'EUR',
  'it': 'EUR',
  'es': 'EUR',
  'nl': 'EUR',
  'ie': 'EUR',
  'at': 'EUR',
  'be': 'EUR',
  'fi': 'EUR',
  'pt': 'EUR',
  'com.be': 'EUR',
  'ca': 'CAD',
  'au': 'AUD',
  'com.au': 'AUD',
  'nz': 'NZD',
  'co.nz': 'NZD',
  'jp': 'JPY',
  'co.jp': 'JPY',
  'ae': 'AED',
  'sa': 'SAR',
  'com.sa': 'SAR',
  'sg': 'SGD',
  'com.sg': 'SGD',
  'br': 'BRL',
  'com.br': 'BRL',
  'mx': 'MXN',
  'com.mx': 'MXN',
  'se': 'SEK',
  'pl': 'PLN',
  'ch': 'CHF',
  'tr': 'TRY',
  'com.tr': 'TRY',
  'eg': 'EGP',
  'com.eg': 'EGP',
  'za': 'ZAR',
  'co.za': 'ZAR',
}

/** Region (ISO 3166) -> currency, for detecting the user's own currency. */
const REGION_CURRENCY: Record<string, string> = {
  IN: 'INR', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', SG: 'SGD',
  AE: 'AED', SA: 'SAR', BR: 'BRL', MX: 'MXN', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN',
  CH: 'CHF', TR: 'TRY', EG: 'EGP', ZA: 'ZAR', KR: 'KRW', CN: 'CNY', HK: 'HKD', ID: 'IDR',
  MY: 'MYR', TH: 'THB', PH: 'PHP', VN: 'VND', BD: 'BDT', PK: 'PKR', LK: 'LKR', NP: 'NPR',
  NG: 'NGN', KE: 'KES', IL: 'ILS', CZ: 'CZK', HU: 'HUF', RO: 'RON', AR: 'ARS', CL: 'CLP',
  CO: 'COP', PE: 'PEN',
  // Eurozone
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', IE: 'EUR', AT: 'EUR', BE: 'EUR',
  FI: 'EUR', PT: 'EUR', GR: 'EUR', SK: 'EUR', SI: 'EUR', LU: 'EUR', LT: 'EUR', LV: 'EUR',
  EE: 'EUR', HR: 'EUR', MT: 'EUR', CY: 'EUR',
}

/** Time zones that pin down a country even when the browser language doesn't (e.g. en-US in India). */
const TIMEZONE_REGION: Record<string, string> = {
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Europe/London': 'GB', 'Asia/Tokyo': 'JP',
  'Asia/Singapore': 'SG', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU',
  'Pacific/Auckland': 'NZ', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
  'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Warsaw': 'PL',
  'Europe/Zurich': 'CH', 'Europe/Istanbul': 'TR', 'Africa/Cairo': 'EG', 'Africa/Johannesburg': 'ZA',
  'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Jakarta': 'ID',
  'Asia/Kuala_Lumpur': 'MY', 'Asia/Bangkok': 'TH', 'Asia/Manila': 'PH', 'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Dhaka': 'BD', 'Asia/Karachi': 'PK', 'Asia/Colombo': 'LK', 'Asia/Kathmandu': 'NP',
  'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Asia/Jerusalem': 'IL',
  'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Rome': 'IT', 'Europe/Madrid': 'ES',
  'Europe/Amsterdam': 'NL', 'Europe/Dublin': 'IE', 'Europe/Vienna': 'AT', 'Europe/Brussels': 'BE',
  'Europe/Helsinki': 'FI', 'Europe/Lisbon': 'PT', 'Europe/Athens': 'GR',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA',
}

export const FALLBACK_CURRENCY = 'USD'

export function isCurrencyCode(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) return false
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: value })
    return true
  } catch {
    return false
  }
}

/** Currency implied by a store's domain, or null when the domain doesn't say (.com, .net, …). */
export function currencyFromUrl(url: string): string | null {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  const parts = host.split('.')
  return DOMAIN_CURRENCY[parts.slice(-2).join('.')] ?? DOMAIN_CURRENCY[parts[parts.length - 1]] ?? null
}

function regionFromLocale(locale: string): string | null {
  try {
    return new Intl.Locale(locale).region ?? null
  } catch {
    return null
  }
}

/**
 * Best guess at the user's own currency. Time zone wins over browser language,
 * because many people (for example in India) browse with an en-US language setting.
 */
export function detectUserCurrency(
  languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages,
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  const tzRegion = TIMEZONE_REGION[timeZone]
  if (tzRegion && REGION_CURRENCY[tzRegion]) return REGION_CURRENCY[tzRegion]
  for (const lang of languages) {
    const region = regionFromLocale(lang)
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region]
  }
  return FALLBACK_CURRENCY
}

/** The currency a newly added item should start with; the user can still change it. */
export function currencyForNewItem(url: string | null, userCurrency: string): string {
  return (url && currencyFromUrl(url)) || userCurrency
}

/** Every currency the browser can format, with a readable name, for the currency picker. */
export function currencyOptions(locale?: string): { code: string; name: string }[] {
  const codes = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : Object.values(REGION_CURRENCY)
  const names = new Intl.DisplayNames(locale ? [locale] : undefined, { type: 'currency' })
  return [...new Set(codes)]
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
