export const EU_COUNTRY_CODES = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI',
  'FR','GR','HR','HU','IE','IT','LT','LU','LV','MT',
  'NL','PL','PT','RO','SE','SI','SK',
])

export function getBillingRegion(countryCode: string | null | undefined): 'eu' | 'row' {
  if (!countryCode) return 'row'
  return EU_COUNTRY_CODES.has(countryCode.toUpperCase()) ? 'eu' : 'row'
}
