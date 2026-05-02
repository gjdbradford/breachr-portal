import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ScanProgress from '@/components/ScanProgress'

export default async function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scan } = await supabase
    .from('scans')
    .select('*, attack_surfaces(name, target_url, target_type)')
    .eq('id', id)
    .single()

  if (!scan) redirect('/dashboard/scans')

  const { data: findings } = await supabase
    .from('findings')
    .select('*')
    .eq('scan_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="portal-content">
      <ScanProgress scan={scan} initialFindings={findings ?? []} />
    </div>
  )
}
