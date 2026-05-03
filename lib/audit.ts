export const GENESIS_HASH = '0'.repeat(64)

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashFinding(f: {
  scan_id: string
  title: string
  severity: string
  owasp_category?: string | null
  cvss_score?: number | null
  ai_model?: string | null
  ai_confidence?: number | null
}): Promise<string> {
  const canonical = [
    f.scan_id,
    f.title,
    f.severity,
    f.owasp_category ?? '',
    String(f.cvss_score ?? ''),
    f.ai_model ?? '',
    String(f.ai_confidence ?? ''),
  ].join('|')
  return sha256Hex(canonical)
}
