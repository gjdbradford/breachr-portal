'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3 | 4

const COUNTRIES = [
  { code: 'AF', flag: '🇦🇫', name: 'Afghanistan',                  dial: '+93' },
  { code: 'AL', flag: '🇦🇱', name: 'Albania',                      dial: '+355' },
  { code: 'DZ', flag: '🇩🇿', name: 'Algeria',                      dial: '+213' },
  { code: 'AD', flag: '🇦🇩', name: 'Andorra',                      dial: '+376' },
  { code: 'AO', flag: '🇦🇴', name: 'Angola',                       dial: '+244' },
  { code: 'AG', flag: '🇦🇬', name: 'Antigua and Barbuda',          dial: '+1-268' },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina',                    dial: '+54' },
  { code: 'AM', flag: '🇦🇲', name: 'Armenia',                      dial: '+374' },
  { code: 'AU', flag: '🇦🇺', name: 'Australia',                    dial: '+61' },
  { code: 'AT', flag: '🇦🇹', name: 'Austria',                      dial: '+43' },
  { code: 'AZ', flag: '🇦🇿', name: 'Azerbaijan',                   dial: '+994' },
  { code: 'BS', flag: '🇧🇸', name: 'Bahamas',                      dial: '+1-242' },
  { code: 'BH', flag: '🇧🇭', name: 'Bahrain',                      dial: '+973' },
  { code: 'BD', flag: '🇧🇩', name: 'Bangladesh',                   dial: '+880' },
  { code: 'BB', flag: '🇧🇧', name: 'Barbados',                     dial: '+1-246' },
  { code: 'BY', flag: '🇧🇾', name: 'Belarus',                      dial: '+375' },
  { code: 'BE', flag: '🇧🇪', name: 'Belgium',                      dial: '+32' },
  { code: 'BZ', flag: '🇧🇿', name: 'Belize',                       dial: '+501' },
  { code: 'BJ', flag: '🇧🇯', name: 'Benin',                        dial: '+229' },
  { code: 'BT', flag: '🇧🇹', name: 'Bhutan',                       dial: '+975' },
  { code: 'BO', flag: '🇧🇴', name: 'Bolivia',                      dial: '+591' },
  { code: 'BA', flag: '🇧🇦', name: 'Bosnia and Herzegovina',       dial: '+387' },
  { code: 'BW', flag: '🇧🇼', name: 'Botswana',                     dial: '+267' },
  { code: 'BR', flag: '🇧🇷', name: 'Brazil',                       dial: '+55' },
  { code: 'BN', flag: '🇧🇳', name: 'Brunei',                       dial: '+673' },
  { code: 'BG', flag: '🇧🇬', name: 'Bulgaria',                     dial: '+359' },
  { code: 'BF', flag: '🇧🇫', name: 'Burkina Faso',                 dial: '+226' },
  { code: 'BI', flag: '🇧🇮', name: 'Burundi',                      dial: '+257' },
  { code: 'CV', flag: '🇨🇻', name: 'Cabo Verde',                   dial: '+238' },
  { code: 'KH', flag: '🇰🇭', name: 'Cambodia',                     dial: '+855' },
  { code: 'CM', flag: '🇨🇲', name: 'Cameroon',                     dial: '+237' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada',                       dial: '+1' },
  { code: 'CF', flag: '🇨🇫', name: 'Central African Republic',     dial: '+236' },
  { code: 'TD', flag: '🇹🇩', name: 'Chad',                         dial: '+235' },
  { code: 'CL', flag: '🇨🇱', name: 'Chile',                        dial: '+56' },
  { code: 'CN', flag: '🇨🇳', name: 'China',                        dial: '+86' },
  { code: 'CO', flag: '🇨🇴', name: 'Colombia',                     dial: '+57' },
  { code: 'KM', flag: '🇰🇲', name: 'Comoros',                      dial: '+269' },
  { code: 'CG', flag: '🇨🇬', name: 'Congo',                        dial: '+242' },
  { code: 'CD', flag: '🇨🇩', name: 'Congo (DRC)',                  dial: '+243' },
  { code: 'CR', flag: '🇨🇷', name: 'Costa Rica',                   dial: '+506' },
  { code: 'CI', flag: '🇨🇮', name: "Côte d'Ivoire",               dial: '+225' },
  { code: 'HR', flag: '🇭🇷', name: 'Croatia',                      dial: '+385' },
  { code: 'CU', flag: '🇨🇺', name: 'Cuba',                         dial: '+53' },
  { code: 'CY', flag: '🇨🇾', name: 'Cyprus',                       dial: '+357' },
  { code: 'CZ', flag: '🇨🇿', name: 'Czech Republic',               dial: '+420' },
  { code: 'DK', flag: '🇩🇰', name: 'Denmark',                      dial: '+45' },
  { code: 'DJ', flag: '🇩🇯', name: 'Djibouti',                     dial: '+253' },
  { code: 'DM', flag: '🇩🇲', name: 'Dominica',                     dial: '+1-767' },
  { code: 'DO', flag: '🇩🇴', name: 'Dominican Republic',           dial: '+1-809' },
  { code: 'EC', flag: '🇪🇨', name: 'Ecuador',                      dial: '+593' },
  { code: 'EG', flag: '🇪🇬', name: 'Egypt',                        dial: '+20' },
  { code: 'SV', flag: '🇸🇻', name: 'El Salvador',                  dial: '+503' },
  { code: 'GQ', flag: '🇬🇶', name: 'Equatorial Guinea',            dial: '+240' },
  { code: 'ER', flag: '🇪🇷', name: 'Eritrea',                      dial: '+291' },
  { code: 'EE', flag: '🇪🇪', name: 'Estonia',                      dial: '+372' },
  { code: 'SZ', flag: '🇸🇿', name: 'Eswatini',                     dial: '+268' },
  { code: 'ET', flag: '🇪🇹', name: 'Ethiopia',                     dial: '+251' },
  { code: 'FJ', flag: '🇫🇯', name: 'Fiji',                         dial: '+679' },
  { code: 'FI', flag: '🇫🇮', name: 'Finland',                      dial: '+358' },
  { code: 'FR', flag: '🇫🇷', name: 'France',                       dial: '+33' },
  { code: 'GA', flag: '🇬🇦', name: 'Gabon',                        dial: '+241' },
  { code: 'GM', flag: '🇬🇲', name: 'Gambia',                       dial: '+220' },
  { code: 'GE', flag: '🇬🇪', name: 'Georgia',                      dial: '+995' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany',                      dial: '+49' },
  { code: 'GH', flag: '🇬🇭', name: 'Ghana',                        dial: '+233' },
  { code: 'GR', flag: '🇬🇷', name: 'Greece',                       dial: '+30' },
  { code: 'GD', flag: '🇬🇩', name: 'Grenada',                      dial: '+1-473' },
  { code: 'GT', flag: '🇬🇹', name: 'Guatemala',                    dial: '+502' },
  { code: 'GN', flag: '🇬🇳', name: 'Guinea',                       dial: '+224' },
  { code: 'GW', flag: '🇬🇼', name: 'Guinea-Bissau',                dial: '+245' },
  { code: 'GY', flag: '🇬🇾', name: 'Guyana',                       dial: '+592' },
  { code: 'HT', flag: '🇭🇹', name: 'Haiti',                        dial: '+509' },
  { code: 'HN', flag: '🇭🇳', name: 'Honduras',                     dial: '+504' },
  { code: 'HU', flag: '🇭🇺', name: 'Hungary',                      dial: '+36' },
  { code: 'IS', flag: '🇮🇸', name: 'Iceland',                      dial: '+354' },
  { code: 'IN', flag: '🇮🇳', name: 'India',                        dial: '+91' },
  { code: 'ID', flag: '🇮🇩', name: 'Indonesia',                    dial: '+62' },
  { code: 'IR', flag: '🇮🇷', name: 'Iran',                         dial: '+98' },
  { code: 'IQ', flag: '🇮🇶', name: 'Iraq',                         dial: '+964' },
  { code: 'IE', flag: '🇮🇪', name: 'Ireland',                      dial: '+353' },
  { code: 'IL', flag: '🇮🇱', name: 'Israel',                       dial: '+972' },
  { code: 'IT', flag: '🇮🇹', name: 'Italy',                        dial: '+39' },
  { code: 'JM', flag: '🇯🇲', name: 'Jamaica',                      dial: '+1-876' },
  { code: 'JP', flag: '🇯🇵', name: 'Japan',                        dial: '+81' },
  { code: 'JO', flag: '🇯🇴', name: 'Jordan',                       dial: '+962' },
  { code: 'KZ', flag: '🇰🇿', name: 'Kazakhstan',                   dial: '+7' },
  { code: 'KE', flag: '🇰🇪', name: 'Kenya',                        dial: '+254' },
  { code: 'KI', flag: '🇰🇮', name: 'Kiribati',                     dial: '+686' },
  { code: 'KW', flag: '🇰🇼', name: 'Kuwait',                       dial: '+965' },
  { code: 'KG', flag: '🇰🇬', name: 'Kyrgyzstan',                   dial: '+996' },
  { code: 'LA', flag: '🇱🇦', name: 'Laos',                         dial: '+856' },
  { code: 'LV', flag: '🇱🇻', name: 'Latvia',                       dial: '+371' },
  { code: 'LB', flag: '🇱🇧', name: 'Lebanon',                      dial: '+961' },
  { code: 'LS', flag: '🇱🇸', name: 'Lesotho',                      dial: '+266' },
  { code: 'LR', flag: '🇱🇷', name: 'Liberia',                      dial: '+231' },
  { code: 'LY', flag: '🇱🇾', name: 'Libya',                        dial: '+218' },
  { code: 'LI', flag: '🇱🇮', name: 'Liechtenstein',                dial: '+423' },
  { code: 'LT', flag: '🇱🇹', name: 'Lithuania',                    dial: '+370' },
  { code: 'LU', flag: '🇱🇺', name: 'Luxembourg',                   dial: '+352' },
  { code: 'MG', flag: '🇲🇬', name: 'Madagascar',                   dial: '+261' },
  { code: 'MW', flag: '🇲🇼', name: 'Malawi',                       dial: '+265' },
  { code: 'MY', flag: '🇲🇾', name: 'Malaysia',                     dial: '+60' },
  { code: 'MV', flag: '🇲🇻', name: 'Maldives',                     dial: '+960' },
  { code: 'ML', flag: '🇲🇱', name: 'Mali',                         dial: '+223' },
  { code: 'MT', flag: '🇲🇹', name: 'Malta',                        dial: '+356' },
  { code: 'MH', flag: '🇲🇭', name: 'Marshall Islands',             dial: '+692' },
  { code: 'MR', flag: '🇲🇷', name: 'Mauritania',                   dial: '+222' },
  { code: 'MU', flag: '🇲🇺', name: 'Mauritius',                    dial: '+230' },
  { code: 'MX', flag: '🇲🇽', name: 'Mexico',                       dial: '+52' },
  { code: 'FM', flag: '🇫🇲', name: 'Micronesia',                   dial: '+691' },
  { code: 'MD', flag: '🇲🇩', name: 'Moldova',                      dial: '+373' },
  { code: 'MC', flag: '🇲🇨', name: 'Monaco',                       dial: '+377' },
  { code: 'MN', flag: '🇲🇳', name: 'Mongolia',                     dial: '+976' },
  { code: 'ME', flag: '🇲🇪', name: 'Montenegro',                   dial: '+382' },
  { code: 'MA', flag: '🇲🇦', name: 'Morocco',                      dial: '+212' },
  { code: 'MZ', flag: '🇲🇿', name: 'Mozambique',                   dial: '+258' },
  { code: 'MM', flag: '🇲🇲', name: 'Myanmar',                      dial: '+95' },
  { code: 'NA', flag: '🇳🇦', name: 'Namibia',                      dial: '+264' },
  { code: 'NR', flag: '🇳🇷', name: 'Nauru',                        dial: '+674' },
  { code: 'NP', flag: '🇳🇵', name: 'Nepal',                        dial: '+977' },
  { code: 'NL', flag: '🇳🇱', name: 'Netherlands',                  dial: '+31' },
  { code: 'NZ', flag: '🇳🇿', name: 'New Zealand',                  dial: '+64' },
  { code: 'NI', flag: '🇳🇮', name: 'Nicaragua',                    dial: '+505' },
  { code: 'NE', flag: '🇳🇪', name: 'Niger',                        dial: '+227' },
  { code: 'NG', flag: '🇳🇬', name: 'Nigeria',                      dial: '+234' },
  { code: 'NO', flag: '🇳🇴', name: 'Norway',                       dial: '+47' },
  { code: 'OM', flag: '🇴🇲', name: 'Oman',                         dial: '+968' },
  { code: 'PK', flag: '🇵🇰', name: 'Pakistan',                     dial: '+92' },
  { code: 'PW', flag: '🇵🇼', name: 'Palau',                        dial: '+680' },
  { code: 'PA', flag: '🇵🇦', name: 'Panama',                       dial: '+507' },
  { code: 'PG', flag: '🇵🇬', name: 'Papua New Guinea',             dial: '+675' },
  { code: 'PY', flag: '🇵🇾', name: 'Paraguay',                     dial: '+595' },
  { code: 'PE', flag: '🇵🇪', name: 'Peru',                         dial: '+51' },
  { code: 'PH', flag: '🇵🇭', name: 'Philippines',                  dial: '+63' },
  { code: 'PL', flag: '🇵🇱', name: 'Poland',                       dial: '+48' },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal',                     dial: '+351' },
  { code: 'QA', flag: '🇶🇦', name: 'Qatar',                        dial: '+974' },
  { code: 'RO', flag: '🇷🇴', name: 'Romania',                      dial: '+40' },
  { code: 'RU', flag: '🇷🇺', name: 'Russia',                       dial: '+7' },
  { code: 'RW', flag: '🇷🇼', name: 'Rwanda',                       dial: '+250' },
  { code: 'KN', flag: '🇰🇳', name: 'Saint Kitts and Nevis',        dial: '+1-869' },
  { code: 'LC', flag: '🇱🇨', name: 'Saint Lucia',                  dial: '+1-758' },
  { code: 'VC', flag: '🇻🇨', name: 'Saint Vincent and Grenadines', dial: '+1-784' },
  { code: 'WS', flag: '🇼🇸', name: 'Samoa',                        dial: '+685' },
  { code: 'SM', flag: '🇸🇲', name: 'San Marino',                   dial: '+378' },
  { code: 'ST', flag: '🇸🇹', name: 'São Tomé and Príncipe',        dial: '+239' },
  { code: 'SA', flag: '🇸🇦', name: 'Saudi Arabia',                 dial: '+966' },
  { code: 'SN', flag: '🇸🇳', name: 'Senegal',                      dial: '+221' },
  { code: 'RS', flag: '🇷🇸', name: 'Serbia',                       dial: '+381' },
  { code: 'SC', flag: '🇸🇨', name: 'Seychelles',                   dial: '+248' },
  { code: 'SL', flag: '🇸🇱', name: 'Sierra Leone',                 dial: '+232' },
  { code: 'SG', flag: '🇸🇬', name: 'Singapore',                    dial: '+65' },
  { code: 'SK', flag: '🇸🇰', name: 'Slovakia',                     dial: '+421' },
  { code: 'SI', flag: '🇸🇮', name: 'Slovenia',                     dial: '+386' },
  { code: 'SB', flag: '🇸🇧', name: 'Solomon Islands',              dial: '+677' },
  { code: 'SO', flag: '🇸🇴', name: 'Somalia',                      dial: '+252' },
  { code: 'ZA', flag: '🇿🇦', name: 'South Africa',                 dial: '+27' },
  { code: 'SS', flag: '🇸🇸', name: 'South Sudan',                  dial: '+211' },
  { code: 'ES', flag: '🇪🇸', name: 'Spain',                        dial: '+34' },
  { code: 'LK', flag: '🇱🇰', name: 'Sri Lanka',                    dial: '+94' },
  { code: 'SD', flag: '🇸🇩', name: 'Sudan',                        dial: '+249' },
  { code: 'SR', flag: '🇸🇷', name: 'Suriname',                     dial: '+597' },
  { code: 'SE', flag: '🇸🇪', name: 'Sweden',                       dial: '+46' },
  { code: 'CH', flag: '🇨🇭', name: 'Switzerland',                  dial: '+41' },
  { code: 'SY', flag: '🇸🇾', name: 'Syria',                        dial: '+963' },
  { code: 'TW', flag: '🇹🇼', name: 'Taiwan',                       dial: '+886' },
  { code: 'TJ', flag: '🇹🇯', name: 'Tajikistan',                   dial: '+992' },
  { code: 'TZ', flag: '🇹🇿', name: 'Tanzania',                     dial: '+255' },
  { code: 'TH', flag: '🇹🇭', name: 'Thailand',                     dial: '+66' },
  { code: 'TL', flag: '🇹🇱', name: 'Timor-Leste',                  dial: '+670' },
  { code: 'TG', flag: '🇹🇬', name: 'Togo',                         dial: '+228' },
  { code: 'TO', flag: '🇹🇴', name: 'Tonga',                        dial: '+676' },
  { code: 'TT', flag: '🇹🇹', name: 'Trinidad and Tobago',          dial: '+1-868' },
  { code: 'TN', flag: '🇹🇳', name: 'Tunisia',                      dial: '+216' },
  { code: 'TR', flag: '🇹🇷', name: 'Turkey',                       dial: '+90' },
  { code: 'TM', flag: '🇹🇲', name: 'Turkmenistan',                 dial: '+993' },
  { code: 'TV', flag: '🇹🇻', name: 'Tuvalu',                       dial: '+688' },
  { code: 'UG', flag: '🇺🇬', name: 'Uganda',                       dial: '+256' },
  { code: 'UA', flag: '🇺🇦', name: 'Ukraine',                      dial: '+380' },
  { code: 'AE', flag: '🇦🇪', name: 'United Arab Emirates',         dial: '+971' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom',               dial: '+44' },
  { code: 'US', flag: '🇺🇸', name: 'United States',                dial: '+1' },
  { code: 'UY', flag: '🇺🇾', name: 'Uruguay',                      dial: '+598' },
  { code: 'UZ', flag: '🇺🇿', name: 'Uzbekistan',                   dial: '+998' },
  { code: 'VU', flag: '🇻🇺', name: 'Vanuatu',                      dial: '+678' },
  { code: 'VE', flag: '🇻🇪', name: 'Venezuela',                    dial: '+58' },
  { code: 'VN', flag: '🇻🇳', name: 'Vietnam',                      dial: '+84' },
  { code: 'YE', flag: '🇾🇪', name: 'Yemen',                        dial: '+967' },
  { code: 'ZM', flag: '🇿🇲', name: 'Zambia',                       dial: '+260' },
  { code: 'ZW', flag: '🇿🇼', name: 'Zimbabwe',                     dial: '+263' },
]

const FRAMEWORKS = [
  {
    id: 'DORA',
    label: 'DORA',
    full: 'Digital Operational Resilience Act',
    desc: 'Mandatory for EU financial entities from Jan 2025.',
    badge: 'EU · Financial',
    color: '#3b82f6',
  },
  {
    id: 'NIS2',
    label: 'NIS2',
    full: 'Network & Information Security Directive 2',
    desc: 'Critical infrastructure & essential services operators.',
    badge: 'EU · All sectors',
    color: '#8b5cf6',
  },
  {
    id: 'PCI-DSS',
    label: 'PCI-DSS',
    full: 'Payment Card Industry Data Security Standard',
    desc: 'Required if you process, store or transmit card data.',
    badge: 'Global · Payments',
    color: '#10b981',
  },
  {
    id: 'HIPAA',
    label: 'HIPAA',
    full: 'Health Insurance Portability & Accountability Act',
    desc: 'Applies to health data handlers in the US and globally.',
    badge: 'US · Health',
    color: '#f59e0b',
  },
  {
    id: 'ISO27001',
    label: 'ISO 27001',
    full: 'Information Security Management Standard',
    desc: 'Internationally recognised security certification.',
    badge: 'Global',
    color: '#64748b',
  },
  {
    id: 'SOC2',
    label: 'SOC 2',
    full: 'Service Organisation Control 2',
    desc: 'Trust services criteria for SaaS and cloud providers.',
    badge: 'US · SaaS',
    color: '#ec4899',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]                 = useState<Step>(1)
  const [loading, setLoading]           = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [error, setError]               = useState('')
  const [tenantId, setTenantId]         = useState<string | null>(null)
  const [userId, setUserId]             = useState<string | null>(null)

  // Step 1 — location & mobile
  const [country, setCountry]           = useState('')
  const [mobileNumber, setMobileNumber] = useState('')

  // Step 2 — target URLs
  const [targets, setTargets]           = useState([{ name: '', url: '', type: 'webapp' }])

  // Step 3 — compliance frameworks
  const [frameworks, setFrameworks]     = useState<string[]>([])

  // Step 4 — invite admin
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteSent, setInviteSent]     = useState(false)

  const selectedCountry  = COUNTRIES.find(c => c.code === country)
  const dialCode         = selectedCountry?.dial ?? ''
  const [countryOpen, setCountryOpen]     = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const countryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false)
        setCountrySearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.dial.includes(countrySearch)
  )

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('users').select('tenant_id').eq('id', user.id).single()
      if (!profile) { setLoadingProfile(false); return }

      setTenantId(profile.tenant_id)

      const { data: tenant } = await supabase
        .from('tenants')
        .select('country, compliance_frameworks, onboarding_complete')
        .eq('id', profile.tenant_id)
        .single()

      if (tenant) {
        if (tenant.onboarding_complete) { router.push('/dashboard'); return }
        if (tenant.country)              setCountry(tenant.country)
        if (tenant.compliance_frameworks?.length) setFrameworks(tenant.compliance_frameworks)
      }

      setLoadingProfile(false)
    })
  }, [router])

  // Step 1 — save country + mobile, advance
  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId || !userId) return
    setLoading(true); setError('')
    const supabase = createClient()

    const fullPhone = mobileNumber.trim() ? `${dialCode} ${mobileNumber.trim()}` : null

    const [tenantRes] = await Promise.all([
      supabase.from('tenants').update({ country }).eq('id', tenantId),
      fullPhone
        ? supabase.from('users').update({ phone: fullPhone } as any).eq('id', userId)
        : Promise.resolve({ error: null }),
    ])

    if (tenantRes.error) { setError(tenantRes.error.message); setLoading(false); return }
    setStep(2); setLoading(false)
  }

  // Step 2 — save targets (skip if empty)
  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return
    setLoading(true); setError('')
    const supabase = createClient()

    const rows = targets
      .filter(t => t.name.trim() && t.url.trim())
      .map(t => ({ tenant_id: tenantId, name: t.name, target_url: t.url, target_type: t.type, active: true }))

    if (rows.length > 0) {
      const { error } = await supabase.from('attack_surfaces').insert(rows)
      if (error) { setError(error.message); setLoading(false); return }
    }

    setStep(3); setLoading(false)
  }

  // Step 3 — save compliance frameworks (skip if none selected)
  async function handleStep3(skip = false) {
    if (!tenantId) return
    setLoading(true)
    const supabase = createClient()
    if (!skip && frameworks.length > 0) {
      await supabase.from('tenants').update({ compliance_frameworks: frameworks }).eq('id', tenantId)
    }
    setStep(4); setLoading(false)
  }

  // Step 4 — invite admin (optional) then finish
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to send invite'); setLoading(false); return }
    setInviteSent(true); setLoading(false)
  }

  async function handleFinish() {
    if (!tenantId) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', tenantId)
    router.push('/dashboard')
  }

  function toggleFramework(id: string) {
    setFrameworks(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  function addTarget() {
    setTargets(prev => [...prev, { name: '', url: '', type: 'webapp' }])
  }

  function updateTarget(i: number, field: string, value: string) {
    setTargets(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  if (loadingProfile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2px solid #42a5f5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading your workspace…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">

        {/* Step progress bars */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {([1, 2, 3, 4] as Step[]).map(s => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: step >= s ? 'linear-gradient(90deg,#1976d2,#42a5f5)' : 'rgba(255,255,255,0.08)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* ── Step 1: Country + Mobile ── */}
        {step === 1 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, letterSpacing: '0.05em' }}>
              WHERE ARE YOU BASED?
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
              Your location sets your regulatory context and enables SMS verification.
            </p>

            <form onSubmit={handleStep1}>
              <div style={{ marginBottom: 16, position: 'relative' }} ref={countryRef}>
                <label className="form-label">Country *</label>
                <button
                  type="button"
                  onClick={() => { setCountryOpen(o => !o); setCountrySearch('') }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: selectedCountry ? '#e2e8f0' : '#475569', fontSize: 14,
                  }}
                >
                  <span>{selectedCountry ? `${selectedCountry.flag}  ${selectedCountry.name}` : 'Select your country'}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, flexShrink: 0, transform: countryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {countryOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                    background: '#0d1428', border: '1px solid rgba(25,118,210,0.3)', borderRadius: 8,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
                  }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search country or dial code…"
                        value={countrySearch}
                        onChange={e => setCountrySearch(e.target.value)}
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 13, outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {filteredCountries.length === 0 && (
                        <div style={{ padding: '12px 14px', color: '#475569', fontSize: 13 }}>No results</div>
                      )}
                      {filteredCountries.map(c => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => { setCountry(c.code); setCountryOpen(false); setCountrySearch('') }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 14px', background: c.code === country ? 'rgba(25,118,210,0.15)' : 'transparent',
                            border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: 14, textAlign: 'left',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = c.code === country ? 'rgba(25,118,210,0.15)' : 'transparent')}
                        >
                          <span style={{ fontSize: 18, lineHeight: 1 }}>{c.flag}</span>
                          <span style={{ flex: 1 }}>{c.name}</span>
                          <span style={{ color: '#475569', fontSize: 12, fontFamily: 'monospace' }}>{c.dial}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 24 }}>
                <label className="form-label">Mobile number * <span style={{ color: '#475569', fontWeight: 400 }}>(used for 2FA &amp; alerts)</span></label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '0 12px', minWidth: 80, whiteSpace: 'nowrap',
                    color: dialCode ? '#94a3b8' : '#334155', fontSize: 14,
                  }}>
                    {selectedCountry ? `${selectedCountry.flag} ${dialCode}` : '—'}
                  </div>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    type="tel"
                    placeholder="30 000 0000"
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value)}
                    required
                    disabled={!country}
                  />
                </div>
                {country && (
                  <p style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                    Full number: {dialCode} {mobileNumber || '—'}
                  </p>
                )}
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</p>}
              <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading || !tenantId}>
                {loading ? 'Saving…' : 'Continue →'}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: Target URLs ── */}
        {step === 2 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 6, letterSpacing: '0.05em' }}>
              ADD TARGET URLS
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>The systems you want Breachr to test. You can add more later.</p>

            <form onSubmit={handleStep2}>
              {targets.map((t, i) => (
                <div key={i} style={{ marginBottom: 16, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label className="form-label">Name</label>
                      <input className="form-input" value={t.name} onChange={e => updateTarget(i, 'name', e.target.value)} placeholder="Main API" />
                    </div>
                    <div>
                      <label className="form-label">Type</label>
                      <select className="form-input" value={t.type} onChange={e => updateTarget(i, 'type', e.target.value)}>
                        <option value="webapp">Web App</option>
                        <option value="api">API</option>
                        <option value="mobile">Mobile</option>
                        <option value="network">Network</option>
                      </select>
                    </div>
                  </div>
                  <label className="form-label">URL</label>
                  <input
                    className="form-input"
                    value={t.url}
                    onChange={e => updateTarget(i, 'url', e.target.value)}
                    onBlur={e => {
                      const v = e.target.value.trim()
                      if (v && !v.startsWith('http')) updateTarget(i, 'url', 'https://' + v)
                    }}
                    placeholder="app.yourcompany.com"
                    type="text"
                  />
                </div>
              ))}

              <button type="button" onClick={addTarget} className="btn-s" style={{ width: '100%', marginBottom: 16, fontSize: 13 }}>
                + Add Another Target
              </button>

              {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</p>}
              <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Saving…' : 'Continue →'}
              </button>
              <button type="button" onClick={() => setStep(3)} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
                Skip for now
              </button>
            </form>
          </>
        )}

        {/* ── Step 3: Compliance Frameworks ── */}
        {step === 3 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, letterSpacing: '0.05em' }}>
              COMPLIANCE OBLIGATIONS
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              Select every framework that applies. This configures your compliance reports and scan coverage.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {FRAMEWORKS.map(fw => {
                const selected = frameworks.includes(fw.id)
                return (
                  <button
                    key={fw.id}
                    type="button"
                    onClick={() => toggleFramework(fw.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                      padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                      background: selected ? `rgba(${fw.color === '#3b82f6' ? '59,130,246' : fw.color === '#8b5cf6' ? '139,92,246' : fw.color === '#10b981' ? '16,185,129' : fw.color === '#f59e0b' ? '245,158,11' : fw.color === '#ec4899' ? '236,72,153' : '100,116,139'},0.1)` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selected ? fw.color + '60' : 'rgba(255,255,255,0.07)'}`,
                      transition: 'all 0.15s',
                      width: '100%',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${selected ? fw.color : 'rgba(255,255,255,0.2)'}`,
                      background: selected ? fw.color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: selected ? '#e2e8f0' : '#94a3b8' }}>{fw.label}</span>
                        <span style={{ fontSize: 10, color: fw.color, background: fw.color + '20', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>{fw.badge}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#475569' }}>{fw.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => handleStep3(false)}
              className="btn-p"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? 'Saving…' : frameworks.length > 0 ? `Save ${frameworks.length} framework${frameworks.length > 1 ? 's' : ''} →` : 'Continue →'}
            </button>
            <button type="button" onClick={() => handleStep3(true)} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
              Skip for now
            </button>
          </>
        )}

        {/* ── Step 4: Invite Admin ── */}
        {step === 4 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, letterSpacing: '0.05em' }}>
              INVITE YOUR SECURITY OFFICER
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
              Add your Admin — they can run scans, manage findings, and generate reports. You control what they can access.
            </p>

            {inviteSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#1976d2,#42a5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>
                  Invite sent to <strong style={{ color: '#42a5f5' }}>{inviteEmail}</strong>
                </p>
                <button onClick={handleFinish} className="btn-p pulse" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Setting up…' : 'Go to Dashboard →'}
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleInvite}>
                  <div style={{ marginBottom: 16 }}>
                    <label className="form-label">Admin email address</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="security@yourcompany.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</p>}
                  <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading || !inviteEmail}>
                    {loading ? 'Sending…' : 'Send Invite →'}
                  </button>
                </form>
                <button type="button" onClick={handleFinish} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer', padding: '6px 0' }} disabled={loading}>
                  {loading ? 'Setting up…' : "I'll do this later"}
                </button>
              </>
            )}
          </>
        )}

      </div>
    </div>
  )
}
