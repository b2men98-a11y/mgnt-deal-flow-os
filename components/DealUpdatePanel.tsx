'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BRAND = { crimson: '#C41230', charcoal: '#1A1A2E', gray: '#4A4A4A', lightGray: '#E5E5E5' }

// ── 타입 ─────────────────────────────────────────────────
interface ScanItem {
  id: string
  type: 'new_deal' | 'deal_update' | 'meeting'
  source: 'gmail' | 'calendar'
  sourceTitle: string
  sourceDate: string
  suggestion: {
    dealTitle?: string
    companyName?: string
    dealType?: string
    targetAmount?: string
    updateDescription?: string
    matchedDealId?: string
    matchedDealTitle?: string
  }
  rawContent: string
  selected: boolean
}

interface Deal {
  id: string
  deal_code: string
  title: string
  company_name: string
  stage: string
}

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

function relativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime(), s = Math.floor(diff / 1000)
  if (s < 60) return '방금 전'
  const m = Math.floor(s / 60); if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function DealUpdatePanel({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: () => void
}) {
  const [step, setStep] = useState<'idle' | 'scanning' | 'analyzing' | 'review' | 'applying' | 'done'>('idle')
  const [scanItems, setScanItems] = useState<ScanItem[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [googleLoaded, setGoogleLoaded] = useState(false)

  const addLog = useCallback((msg: string) => setLogs(p => [...p, msg]), [])

  useEffect(() => {
    // Google GIS 스크립트 로드
    if (!document.querySelector('script[src*="accounts.google.com/gsi"]')) {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => setGoogleLoaded(true)
      document.body.appendChild(script)
    } else {
      setGoogleLoaded(true)
    }

    // 마지막 동기화 시각 로드
    supabase.from('activity_logs')
      .select('created_at').eq('action', 'SYNC')
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setLastSynced(data[0].created_at) })

    // 딜 목록 로드
    supabase.from('deals').select('id,deal_code,title,company_name,stage')
      .then(({ data }) => setDeals(data || []))
  }, [])

  // ── Google OAuth ──────────────────────────────────────
  const requestGoogleAccess = useCallback(() => {
    if (!googleLoaded || !window.google) {
      alert('Google 로그인 준비 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      alert('Vercel 환경변수에 NEXT_PUBLIC_GOOGLE_CLIENT_ID를 추가해주세요.')
      return
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar.readonly',
      ].join(' '),
      callback: (response) => {
        if (response.error) { alert('Google 인증 실패: ' + response.error); return }
        startScan(response.access_token)
      },
    })
    tokenClient.requestAccessToken()
  }, [googleLoaded])

  // ── Gmail + Calendar 스캔 ─────────────────────────────
  const startScan = async (token: string) => {
    setStep('scanning')
    setScanItems([])
    setLogs([])

    type RawItem = { source: 'gmail' | 'calendar'; title: string; date: string; content: string }
    const allRaw: RawItem[] = []

    // Gmail 스캔
    try {
      addLog('📧 Gmail 스캔 중...')
      const since = lastSynced
        ? new Date(lastSynced).toISOString().split('T')[0].replace(/-/g, '/')
        : new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0].replace(/-/g, '/')

      const q = encodeURIComponent(
        `after:${since} (투자 OR 매각 OR 인수 OR 딜 OR deal OR M&A OR 자문 OR NDA OR LOI OR IM OR 미팅 OR meeting OR 협의 OR 제안)`
      )
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=${q}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const listData = await listRes.json()
      const messages: { id: string }[] = listData.messages || []
      addLog(`📧 Gmail ${messages.length}건 발견`)

      for (const msg of messages.slice(0, 15)) {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const msgData = await msgRes.json()
        const headers = msgData.payload?.headers || []
        const subject = headers.find((h: {name:string;value:string}) => h.name === 'Subject')?.value || '(제목 없음)'
        const date = headers.find((h: {name:string;value:string}) => h.name === 'Date')?.value || ''
        const snippet = msgData.snippet || ''
        allRaw.push({ source: 'gmail', title: subject, date, content: snippet })
      }
    } catch {
      addLog('⚠️ Gmail 스캔 오류 (권한 확인 필요)')
    }

    // Calendar 스캔
    try {
      addLog('📅 Google Calendar 스캔 중...')
      const timeMin = lastSynced || new Date(Date.now() - 30 * 86400000).toISOString()
      const timeMax = new Date(Date.now() + 30 * 86400000).toISOString()
      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=30&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const calData = await calRes.json()
      const events: { summary?: string; start?: { dateTime?: string; date?: string }; description?: string }[] = calData.items || []
      addLog(`📅 캘린더 ${events.length}건 발견`)

      for (const ev of events) {
        const title = ev.summary || '(제목 없음)'
        const date = ev.start?.dateTime || ev.start?.date || ''
        const desc = ev.description || ''
        allRaw.push({ source: 'calendar', title, date, content: `${title}\n${desc}` })
      }
    } catch {
      addLog('⚠️ 캘린더 스캔 오류 (권한 확인 필요)')
    }

    addLog(`✅ 총 ${allRaw.length}건 수집. Claude AI 분석 중...`)
    await analyzeWithAI(allRaw)
  }

  // ── Claude AI 분석 ────────────────────────────────────
  const analyzeWithAI = async (rawItems: { source: 'gmail' | 'calendar'; title: string; date: string; content: string }[]) => {
    setStep('analyzing')
    const dealList = deals.map(d => `ID:${d.id} | ${d.deal_code} | ${d.title} | ${d.company_name}`).join('\n')
    const rawText = rawItems.slice(0, 20).map((r, i) =>
      `[${i+1}] 출처:${r.source} | ${r.date}\n제목: ${r.title}\n내용: ${r.content}`
    ).join('\n\n---\n\n')

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 3000,
          system: `You are a deal flow analyst at MGNT Partners (Korean M&A/investment advisory).
Analyze emails and calendar events to extract deal-related information.
Return ONLY a valid JSON array (absolutely no markdown, no explanation):
[{
  "sourceIndex": number,
  "type": "new_deal" | "deal_update" | "meeting",
  "dealTitle": "string or null",
  "companyName": "string or null",
  "dealType": "FUNDRAISING|MA_SELL|MA_BUY|REAL_ESTATE|DATA_CENTER or null",
  "targetAmount": "string or null",
  "updateDescription": "string or null",
  "matchedDealId": "existing deal ID or null",
  "matchedDealTitle": "string or null"
}]
Only include clearly deal-related items. Skip newsletters, spam, generic emails.`,
          messages: [{
            role: 'user',
            content: `기존 딜 목록:\n${dealList || '(없음)'}\n\n분석 데이터:\n${rawText}`
          }]
        })
      })
      const data = await res.json()
      const text = (data.content?.[0]?.text || '[]').replace(/```json\n?|```\n?/g, '').trim()

      type ParsedItem = {
        sourceIndex: number; type: string; dealTitle?: string; companyName?: string
        dealType?: string; targetAmount?: string; updateDescription?: string
        matchedDealId?: string; matchedDealTitle?: string
      }
      const parsed: ParsedItem[] = JSON.parse(text)

      const items: ScanItem[] = parsed.map((p, i) => {
        const raw = rawItems[(p.sourceIndex || 1) - 1] || rawItems[0]
        return {
          id: `scan_${i}_${Date.now()}`,
          type: p.type as ScanItem['type'],
          source: raw?.source || 'gmail',
          sourceTitle: raw?.title || '',
          sourceDate: raw?.date || '',
          suggestion: {
            dealTitle: p.dealTitle || undefined,
            companyName: p.companyName || undefined,
            dealType: p.dealType || undefined,
            targetAmount: p.targetAmount || undefined,
            updateDescription: p.updateDescription || undefined,
            matchedDealId: p.matchedDealId || undefined,
            matchedDealTitle: p.matchedDealTitle || undefined,
          },
          rawContent: raw?.content || '',
          selected: true,
        }
      })

      addLog(`🎯 ${items.length}건의 딜 관련 항목 추출 완료`)
      setScanItems(items)
      setStep('review')
    } catch {
      addLog('⚠️ AI 분석 오류. Anthropic API 키를 확인해주세요.')
      setStep('idle')
    }
  }

  // ── 선택 항목 적용 ────────────────────────────────────
  const applySelected = async () => {
    setStep('applying')
    const selected = scanItems.filter(i => i.selected)
    addLog(`📝 ${selected.length}건 적용 중...`)

    for (const item of selected) {
      try {
        if (item.type === 'new_deal') {
          const { count } = await supabase.from('deals').select('*', { count: 'exact', head: true })
          const dealCode = `MGNT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
          const { data } = await supabase.from('deals').insert({
            deal_code: dealCode,
            title: item.suggestion.dealTitle || item.sourceTitle,
            deal_type: item.suggestion.dealType || 'FUNDRAISING',
            stage: 'SOURCING',
            company_name: item.suggestion.companyName || '',
            company_industry: '',
            description: `[자동수집 - ${item.source === 'gmail' ? '이메일' : '캘린더'}]\n원본: ${item.sourceTitle}\n\n${item.rawContent.slice(0, 300)}`,
          }).select().single()

          if (data) {
            await supabase.from('activity_logs').insert({
              deal_id: data.id,
              action: 'CREATE',
              description: `[자동수집] ${item.suggestion.dealTitle || item.sourceTitle} — ${item.source === 'gmail' ? '이메일' : '캘린더'}에서 등록`,
              author: '딜 업데이트',
            })
            addLog(`✅ 신규 딜 등록: ${item.suggestion.dealTitle || item.sourceTitle}`)
          }
        } else if (item.type === 'deal_update' || item.type === 'meeting') {
          const dealId = item.suggestion.matchedDealId
          if (dealId) {
            const content = item.type === 'meeting'
              ? `[📅 미팅] ${item.sourceTitle}${item.sourceDate ? ` (${new Date(item.sourceDate).toLocaleDateString('ko-KR')})` : ''}`
              : `[📧 이메일 업데이트] ${item.suggestion.updateDescription || item.sourceTitle}`

            await supabase.from('comments').insert({
              deal_id: dealId,
              author: '딜 업데이트',
              content,
            })
            await supabase.from('activity_logs').insert({
              deal_id: dealId,
              action: item.type === 'meeting' ? 'MEETING_SCHEDULED' : 'UPDATE',
              description: content.slice(0, 100),
              author: '딜 업데이트',
            })
            addLog(`✅ 업데이트: ${item.suggestion.matchedDealTitle}`)
          } else {
            addLog(`⚠️ 매칭 딜 없음 (건너뜀): ${item.sourceTitle.slice(0, 30)}`)
          }
        }
      } catch {
        addLog(`❌ 오류: ${item.sourceTitle.slice(0, 30)}`)
      }
    }

    // 동기화 시각 기록
    await supabase.from('activity_logs').insert({
      action: 'SYNC',
      description: `딜 업데이트 완료 — ${selected.length}건 적용`,
      author: '시스템',
    })
    setLastSynced(new Date().toISOString())
    setStep('done')
    addLog(`🎉 완료! ${selected.length}건 적용됨`)
  }

  const inp: React.CSSProperties = {
    padding: '7px 10px', border: `1px solid ${BRAND.lightGray}`,
    borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.65)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ background: BRAND.charcoal, padding: '16px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 9, color: BRAND.crimson, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>Auto Sync</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: '3px 0 0' }}>딜 업데이트</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>
          {lastSynced && (
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '8px 0 0' }}>
              마지막 동기화: {relativeTime(lastSynced)} — 이후 변경분만 스캔합니다
            </p>
          )}
          {!lastSynced && (
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '8px 0 0' }}>
              최초 실행 — 최근 30일 전체를 스캔합니다
            </p>
          )}
        </div>
        <div style={{ height: 3, background: BRAND.crimson, flexShrink: 0 }} />

        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* 초기 화면 */}
          {step === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#F9F9FB', borderRadius: 12, padding: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: BRAND.charcoal, margin: '0 0 12px' }}>스캔 대상</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { icon: '📧', title: 'Gmail', desc: `투자/매각/딜/M&A 관련 이메일 ${lastSynced ? '(변경분)' : '(최근 30일)'}` },
                    { icon: '📅', title: 'Google Calendar', desc: `미팅 일정 ${lastSynced ? '(변경분)' : '(최근 30일 + 향후 30일)'}` },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22, width: 32, textAlign: 'center' }}>{icon}</span>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: BRAND.charcoal }}>{title}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#FFF0F2', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(196,18,48,0.2)' }}>
                <p style={{ fontSize: 12, color: BRAND.crimson, margin: 0 }}>
                  🔒 읽기 전용 접근 — 이메일 발송/수정 불가. 데이터는 외부로 전송되지 않습니다.
                </p>
              </div>

              <button
                onClick={requestGoogleAccess}
                style={{ padding: 14, background: BRAND.crimson, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                <span>🔍</span> Google 연결 후 스캔 시작
              </button>
            </div>
          )}

          {/* 스캔 / 분석 중 */}
          {(step === 'scanning' || step === 'analyzing') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${BRAND.lightGray}`, borderTopColor: BRAND.crimson, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: BRAND.charcoal, margin: 0 }}>
                  {step === 'scanning' ? 'Gmail & 캘린더 스캔 중...' : 'Claude AI가 딜 정보 분석 중...'}
                </p>
              </div>
              <div style={{ background: '#F9F9FB', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.9, color: BRAND.gray, maxHeight: 220, overflow: 'auto' }}>
                {logs.map((l, i) => <div key={i}>{l}</div>)}
                {logs.length === 0 && <span style={{ color: '#9CA3AF' }}>시작 중...</span>}
              </div>
            </div>
          )}

          {/* 검토 화면 */}
          {step === 'review' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: BRAND.charcoal, margin: 0 }}>
                    {scanItems.length}건 발견
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '3px 0 0' }}>
                    체크된 항목만 딜 보드에 반영됩니다
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setScanItems(p => p.map(i => ({...i, selected: true})))} style={{ ...inp, color: '#10B981', fontWeight: 600 }}>전체 선택</button>
                  <button onClick={() => setScanItems(p => p.map(i => ({...i, selected: false})))} style={{ ...inp, color: '#9CA3AF' }}>전체 해제</button>
                </div>
              </div>

              {scanItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: 32, marginBottom: 12 }}>✅</p>
                  <p style={{ fontSize: 14, color: BRAND.charcoal, fontWeight: 600 }}>새로운 딜 관련 항목이 없습니다</p>
                  <p style={{ fontSize: 12, color: '#9CA3AF' }}>이미 최신 상태입니다</p>
                </div>
              )}

              {scanItems.map((item, idx) => {
                const typeStyle = {
                  new_deal:    { bg: '#ECFDF5', text: '#065F46', label: '🆕 신규 딜' },
                  meeting:     { bg: '#EFF6FF', text: '#1D4ED8', label: '📅 미팅' },
                  deal_update: { bg: '#FFF0F2', text: BRAND.crimson, label: '📝 딜 업데이트' },
                }[item.type]

                return (
                  <div
                    key={item.id}
                    onClick={() => setScanItems(p => p.map((i, j) => j === idx ? {...i, selected: !i.selected} : i))}
                    style={{ border: `1.5px solid ${item.selected ? BRAND.crimson : BRAND.lightGray}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10, cursor: 'pointer', background: item.selected ? '#FFF8F8' : 'white', transition: 'all 0.15s' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* 체크박스 */}
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${item.selected ? BRAND.crimson : BRAND.lightGray}`, background: item.selected ? BRAND.crimson : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {item.selected && <span style={{ color: 'white', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: typeStyle.bg, color: typeStyle.text }}>{typeStyle.label}</span>
                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{item.source === 'gmail' ? '📧 Gmail' : '📅 Calendar'}</span>
                      </div>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                        {item.sourceDate ? new Date(item.sourceDate).toLocaleDateString('ko-KR') : ''}
                      </span>
                    </div>

                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 6px', fontStyle: 'italic' }}>원본: {item.sourceTitle}</p>

                    <div style={{ background: '#F9F9FB', borderRadius: 6, padding: '8px 10px' }}>
                      {item.type === 'new_deal' && (
                        <>
                          <p style={{ fontSize: 12, fontWeight: 700, color: BRAND.charcoal, margin: '0 0 3px' }}>{item.suggestion.dealTitle || item.sourceTitle}</p>
                          <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
                            {item.suggestion.companyName && <span>{item.suggestion.companyName}</span>}
                            {item.suggestion.dealType && <span> · {item.suggestion.dealType}</span>}
                            {item.suggestion.targetAmount && <span> · {item.suggestion.targetAmount}</span>}
                          </p>
                        </>
                      )}
                      {(item.type === 'deal_update' || item.type === 'meeting') && (
                        <>
                          {item.suggestion.matchedDealTitle && (
                            <p style={{ fontSize: 11, color: BRAND.crimson, fontWeight: 600, margin: '0 0 3px' }}>→ {item.suggestion.matchedDealTitle}</p>
                          )}
                          <p style={{ fontSize: 11, color: BRAND.gray, margin: 0 }}>{item.suggestion.updateDescription || item.sourceTitle}</p>
                          {!item.suggestion.matchedDealId && (
                            <p style={{ fontSize: 10, color: '#F59E0B', margin: '4px 0 0' }}>⚠️ 매칭 딜 없음 — 적용 시 건너뜁니다</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 적용 중 */}
          {step === 'applying' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${BRAND.lightGray}`, borderTopColor: BRAND.crimson, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: BRAND.charcoal, margin: 0 }}>딜 보드에 반영 중...</p>
              </div>
              <div style={{ background: '#F9F9FB', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.9, color: BRAND.gray }}>
                {logs.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </div>
          )}

          {/* 완료 */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: BRAND.charcoal, marginBottom: 6 }}>업데이트 완료!</p>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>다음 실행 시 이후 변경분만 스캔합니다</p>
              <div style={{ background: '#F9F9FB', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.9, color: BRAND.gray, textAlign: 'left', marginBottom: 20 }}>
                {logs.map((l, i) => <div key={i}>{l}</div>)}
              </div>
              <button onClick={() => { onDone(); onClose() }}
                style={{ padding: '12px 32px', background: BRAND.crimson, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                딜 보드로 돌아가기
              </button>
            </div>
          )}
        </div>

        {/* 하단 적용 버튼 */}
        {step === 'review' && scanItems.filter(i => i.selected).length > 0 && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${BRAND.lightGray}`, flexShrink: 0, background: 'white' }}>
            <button onClick={applySelected}
              style={{ width: '100%', padding: 13, background: BRAND.crimson, color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ✅ 선택한 {scanItems.filter(i => i.selected).length}건 딜 보드에 반영
            </button>
          </div>
        )}

        {step === 'review' && scanItems.length > 0 && scanItems.filter(i => i.selected).length === 0 && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${BRAND.lightGray}`, flexShrink: 0 }}>
            <button onClick={onClose}
              style={{ width: '100%', padding: 13, background: '#F4F4F6', color: '#6B7280', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
