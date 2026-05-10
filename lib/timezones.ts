export interface TzOption {
  iana:     string
  label:    string
  region:   string
  aliases?: string  // extra search terms (city names, offset strings)
}

export const TIMEZONES: TzOption[] = [
  // Europe
  { iana: 'Europe/London',        label: 'London (GMT/BST)',                 region: 'Europe',     aliases: 'utc+0 utc+1 gmt+0 gmt+1 +0 +1' },
  { iana: 'Europe/Dublin',        label: 'Dublin (GMT/IST)',                 region: 'Europe',     aliases: 'utc+0 utc+1 gmt+0 gmt+1 ireland' },
  { iana: 'Europe/Paris',         label: 'Paris (CET/CEST)',                 region: 'Europe',     aliases: 'utc+1 utc+2 gmt+1 gmt+2 +1 +2 france' },
  { iana: 'Europe/Berlin',        label: 'Berlin (CET/CEST)',                region: 'Europe',     aliases: 'utc+1 utc+2 gmt+1 gmt+2 +1 +2 germany' },
  { iana: 'Europe/Amsterdam',     label: 'Amsterdam (CET/CEST)',             region: 'Europe',     aliases: 'utc+1 utc+2 gmt+1 gmt+2 +1 +2 netherlands' },
  { iana: 'Europe/Brussels',      label: 'Brussels (CET/CEST)',              region: 'Europe',     aliases: 'utc+1 utc+2 gmt+1 gmt+2 +1 +2 belgium' },
  { iana: 'Europe/Madrid',        label: 'Madrid (CET/CEST)',                region: 'Europe',     aliases: 'utc+1 utc+2 gmt+1 gmt+2 +1 +2 spain barcelona' },
  { iana: 'Europe/Rome',          label: 'Rome (CET/CEST)',                  region: 'Europe',     aliases: 'utc+1 utc+2 gmt+1 gmt+2 +1 +2 italy milan' },
  { iana: 'Europe/Stockholm',     label: 'Stockholm (CET/CEST)',             region: 'Europe',     aliases: 'utc+1 utc+2 gmt+1 gmt+2 +1 +2 sweden' },
  { iana: 'Europe/Warsaw',        label: 'Warsaw (CET/CEST)',                region: 'Europe',     aliases: 'utc+1 utc+2 gmt+1 gmt+2 +1 +2 poland' },
  { iana: 'Europe/Zurich',        label: 'Zurich (CET/CEST)',                region: 'Europe',     aliases: 'utc+1 utc+2 gmt+1 gmt+2 +1 +2 switzerland geneva' },
  { iana: 'Europe/Lisbon',        label: 'Lisbon (WET/WEST)',                region: 'Europe',     aliases: 'utc+0 utc+1 gmt+0 gmt+1 portugal' },
  { iana: 'Europe/Helsinki',      label: 'Helsinki (EET/EEST)',              region: 'Europe',     aliases: 'utc+2 utc+3 gmt+2 gmt+3 +2 +3 finland' },
  { iana: 'Europe/Athens',        label: 'Athens (EET/EEST)',                region: 'Europe',     aliases: 'utc+2 utc+3 gmt+2 gmt+3 +2 +3 greece' },
  { iana: 'Europe/Bucharest',     label: 'Bucharest (EET/EEST)',             region: 'Europe',     aliases: 'utc+2 utc+3 gmt+2 gmt+3 +2 +3 romania' },
  { iana: 'Europe/Istanbul',      label: 'Istanbul (TRT)',                   region: 'Europe',     aliases: 'utc+3 gmt+3 +3 turkey ankara' },
  { iana: 'Europe/Moscow',        label: 'Moscow (MSK)',                     region: 'Europe',     aliases: 'utc+3 gmt+3 +3 russia' },
  // Americas
  { iana: 'America/New_York',     label: 'New York (ET)',                    region: 'Americas',   aliases: 'utc-5 utc-4 gmt-5 gmt-4 -5 -4 eastern est edt boston miami' },
  { iana: 'America/Chicago',      label: 'Chicago (CT)',                     region: 'Americas',   aliases: 'utc-6 utc-5 gmt-6 gmt-5 -6 -5 central cst cdt dallas houston' },
  { iana: 'America/Denver',       label: 'Denver (MT)',                      region: 'Americas',   aliases: 'utc-7 utc-6 gmt-7 gmt-6 -7 -6 mountain mst mdt' },
  { iana: 'America/Los_Angeles',  label: 'Los Angeles (PT)',                 region: 'Americas',   aliases: 'utc-8 utc-7 gmt-8 gmt-7 -8 -7 pacific pst pdt san francisco seattle' },
  { iana: 'America/Phoenix',      label: 'Phoenix (MST)',                    region: 'Americas',   aliases: 'utc-7 gmt-7 -7 arizona' },
  { iana: 'America/Toronto',      label: 'Toronto (ET)',                     region: 'Americas',   aliases: 'utc-5 utc-4 gmt-5 gmt-4 -5 -4 eastern canada ontario' },
  { iana: 'America/Vancouver',    label: 'Vancouver (PT)',                   region: 'Americas',   aliases: 'utc-8 utc-7 gmt-8 gmt-7 -8 -7 pacific canada bc' },
  { iana: 'America/Sao_Paulo',    label: 'São Paulo (BRT)',                  region: 'Americas',   aliases: 'utc-3 gmt-3 -3 brazil rio' },
  { iana: 'America/Mexico_City',  label: 'Mexico City (CST)',                region: 'Americas',   aliases: 'utc-6 utc-5 gmt-6 gmt-5 -6 -5 mexico' },
  { iana: 'America/Bogota',       label: 'Bogotá (COT)',                     region: 'Americas',   aliases: 'utc-5 gmt-5 -5 colombia' },
  { iana: 'America/Buenos_Aires', label: 'Buenos Aires (ART)',               region: 'Americas',   aliases: 'utc-3 gmt-3 -3 argentina' },
  { iana: 'America/Santiago',     label: 'Santiago (CLT)',                   region: 'Americas',   aliases: 'utc-4 utc-3 gmt-4 gmt-3 -4 -3 chile' },
  // Middle East
  { iana: 'Asia/Dubai',           label: 'Dubai (GST)',                      region: 'Middle East', aliases: 'utc+4 gmt+4 +4 uae abu dhabi' },
  { iana: 'Asia/Riyadh',          label: 'Riyadh (AST)',                     region: 'Middle East', aliases: 'utc+3 gmt+3 +3 saudi arabia jeddah' },
  // Africa
  { iana: 'Africa/Cairo',         label: 'Cairo (EET)',                      region: 'Africa',     aliases: 'utc+2 gmt+2 +2 egypt' },
  { iana: 'Africa/Johannesburg',  label: 'Johannesburg / Cape Town (SAST)',  region: 'Africa',     aliases: 'utc+2 gmt+2 +2 south africa durban pretoria sast' },
  { iana: 'Africa/Lagos',         label: 'Lagos (WAT)',                      region: 'Africa',     aliases: 'utc+1 gmt+1 +1 nigeria abuja' },
  { iana: 'Africa/Nairobi',       label: 'Nairobi (EAT)',                    region: 'Africa',     aliases: 'utc+3 gmt+3 +3 kenya tanzania ethiopia' },
  // Asia
  { iana: 'Asia/Kolkata',         label: 'Mumbai / Delhi (IST)',             region: 'Asia',       aliases: 'utc+5:30 gmt+5:30 +5:30 india bangalore chennai hyderabad' },
  { iana: 'Asia/Dhaka',           label: 'Dhaka (BST)',                      region: 'Asia',       aliases: 'utc+6 gmt+6 +6 bangladesh' },
  { iana: 'Asia/Karachi',         label: 'Karachi (PKT)',                    region: 'Asia',       aliases: 'utc+5 gmt+5 +5 pakistan lahore' },
  { iana: 'Asia/Bangkok',         label: 'Bangkok (ICT)',                    region: 'Asia',       aliases: 'utc+7 gmt+7 +7 thailand vietnam hanoi ho chi minh' },
  { iana: 'Asia/Singapore',       label: 'Singapore (SGT)',                  region: 'Asia',       aliases: 'utc+8 gmt+8 +8 malaysia kuala lumpur' },
  { iana: 'Asia/Shanghai',        label: 'Shanghai / Beijing (CST)',         region: 'Asia',       aliases: 'utc+8 gmt+8 +8 china' },
  { iana: 'Asia/Hong_Kong',       label: 'Hong Kong (HKT)',                  region: 'Asia',       aliases: 'utc+8 gmt+8 +8' },
  { iana: 'Asia/Tokyo',           label: 'Tokyo (JST)',                      region: 'Asia',       aliases: 'utc+9 gmt+9 +9 japan osaka' },
  { iana: 'Asia/Seoul',           label: 'Seoul (KST)',                      region: 'Asia',       aliases: 'utc+9 gmt+9 +9 korea' },
  // Pacific
  { iana: 'Australia/Sydney',     label: 'Sydney (AEST/AEDT)',               region: 'Pacific',    aliases: 'utc+10 utc+11 gmt+10 gmt+11 +10 +11 australia brisbane' },
  { iana: 'Australia/Melbourne',  label: 'Melbourne (AEST/AEDT)',            region: 'Pacific',    aliases: 'utc+10 utc+11 gmt+10 gmt+11 +10 +11 australia' },
  { iana: 'Australia/Perth',      label: 'Perth (AWST)',                     region: 'Pacific',    aliases: 'utc+8 gmt+8 +8 australia' },
  { iana: 'Pacific/Auckland',     label: 'Auckland (NZST/NZDT)',             region: 'Pacific',    aliases: 'utc+12 utc+13 gmt+12 gmt+13 +12 +13 new zealand wellington' },
  // UTC
  { iana: 'UTC',                  label: 'UTC (Coordinated Universal Time)', region: 'UTC',        aliases: 'utc+0 gmt+0 +0 universal' },
]

export const TZ_REGIONS = [...new Set(TIMEZONES.map(t => t.region))]
