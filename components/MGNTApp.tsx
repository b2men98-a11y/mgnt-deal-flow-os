'use client'

import React, { useState, useEffect, useCallback } from 'react'

// ── 브랜드 색상 ──────────────────────────────────────────
const BRAND = {
  crimson: '#C41230',
  charcoal: '#1A1A2E',
  white: '#FFFFFF',
  gray: '#4A4A4A',
  lightGray: '#E5E5E5',
}

// ── 타입 정의 ─────────────────────────────────────────────
interface Company { name: string; industry: string }
interface Assignee { user: { id: string; name: string; avatarUrl: string | null } }
interface Count { documents: number; investorMatches: number }

interface Deal {
  id: string
  dealCode: string
  title: string
  dealType: string
  stage: string
  status: string
  targetAmount: number | null
  company: Company
  assignees: Assignee[]
  dueDate: string | null
  _count: Count
}

interface Log {
  id: string
  action: string
  entityType: string
  description: string
  user: { name: string }
  createdAt: string
  deal: { dealCode: string } | null
  prevSnapshot: Record<string, unknown> | null
  nextSnapshot: Record<string, unknown> | null
}

// ── 상수 ──────────────────────────────────────────────────
const STAGES = [
  { id: 'SOURCING',     label: 'Sourcing',     color: '#6B7280' },
  { id: 'PREPARATION',  label: 'Preparation',  color: '#3B82F6' },
  { id: 'MARKETING',    label: 'Marketing',    color: '#8B5CF6' },
  { id: 'EXECUTION',    label: 'Execution',    color: '#F59E0B' },
  { id: 'CLOSING',      label: 'Closing',      color: '#C41230' },
]

const DEAL_TYPE_META: Record<string, { label: string; bg: string; text: string }> = {
  FUNDRAISING: { label: 'Fund', bg: '#EFF6FF', text: '#1D4ED8' },
  MA_SELL:     { label: 'M&A',  bg: '#FFFBEB', text: '#92400E' },
  MA_BUY:      { label: 'Buy',  bg: '#F5F3FF', text: '#5B21B6' },
  REAL_ESTATE: { label: 'RE',   bg: '#ECFDF5', text: '#065F46' },
  DATA_CENTER: { label: 'DC',   bg: '#FFF0F2', text: '#C41230' },
}

const ACTION_STYLE: Record<string, { dot: string; label: string; icon: string }> = {
  CREATE:             { dot: '#10B981', label: '생성', icon: '+' },
  UPDATE:             { dot: '#3B82F6', label: '수정', icon: '↻' },
  DELETE:             { dot: '#EF4444', label: '삭제', icon: '×' },
  STAGE_CHANGE:       { dot: '#8B5CF6', label: '이동', icon: '→' },
  DOCUMENT_GENERATED: { dot: '#C41230', label: '문서', icon: '⬡' },
}

const INITIAL_DEALS: Deal[] = [
  { id: 'd1', dealCode: 'MGNT-2025-001', title: '그린에너지 시리즈B 투자유치', dealType: 'FUNDRAISING', stage: 'MARKETING',    status: 'ACTIVE', targetAmount: 30000,  company: { name: '그린에너지(주)', industry: '클린테크'    }, assignees: [{ user: { id: 'u1', name: '김민준', avatarUrl: null } }], dueDate: new Date(Date.now() + 14 * 86400000).toISOString(), _count: { documents: 2, investorMatches: 8 } },
  { id: 'd2', dealCode: 'MGNT-2025-002', title: '스마트물류 기업 매각',        dealType: 'MA_SELL',     stage: 'EXECUTION',    status: 'ACTIVE', targetAmount: 85000,  company: { name: '스마트물류(주)', industry: '물류/SCM'     }, assignees: [{ user: { id: 'u2', name: '이서연', avatarUrl: null } }, { user: { id: 'u3', name: '박도현', avatarUrl: null } }], dueDate: new Date(Date.now() + 7 * 86400000).toISOString(), _count: { documents: 5, investorMatches: 3 } },
  { id: 'd3', dealCode: 'MGNT-2025-003', title: '서울 강남 데이터센터 개발',   dealType: 'DATA_CENTER', stage: 'PREPARATION',  status: 'ACTIVE', targetAmount: 200000, company: { name: 'DC개발(주)',    industry: '부동산/인프라' }, assignees: [{ user: { id: 'u1', name: '김민준', avatarUrl: null } }], dueDate: new Date(Date.now() + 45 * 86400000).toISOString(), _count: { documents: 1, investorMatches: 0 } },
  { id: 'd4', dealCode: 'MGNT-2025-004', title: '핀테크 플랫폼 시리즈A',       dealType: 'FUNDRAISING', stage: 'SOURCING',     status: 'ACTIVE', targetAmount: 15000,  company: { name: '페이테크(주)', industry: '핀테크'        }, assignees: [{ user: { id: 'u3', name: '박도현', avatarUrl: null } }], dueDate: null, _count: { documents: 0, investorMatches: 0 } },
  { id: 'd5', dealCode: 'MGNT-2025-005', title: '부동산 리츠 투자 구조화',     dealType: 'REAL_ESTATE', stage: 'CLOSING',      status: 'ACTIVE', targetAmount: 50000,  company: { name: '리얼에셋(주)', industry: '부동산'        }, assignees: [{ user: { id: 'u2', name: '이서연', avatarUrl: null } }], dueDate: new Date(Date.now() + 3 * 86400000).toISOString(), _count: { documents: 8, investorMatches: 1 } },
]

const INITIAL_LOGS: Log[] = [
  { id: 'l1', action: 'STAGE_CHANGE',       entityType: 'Deal',     description: '스마트물류 → EXECUTION으로 이동',    user: { name: '이서연' }, createdAt: new Date(Date.now() - 3 * 60000).toISOString(),     deal: { dealCode: 'MGNT-2025-002' }, prevSnapshot: { stage: 'MARKETING' },      nextSnapshot: { stage: 'EXECUTION' } },
  { id: 'l2', action: 'DOCUMENT_GENERATED', entityType: 'Document', description: '그린에너지 IM 초안 AI 생성 완료',   user: { name: '김민준' }, createdAt: new Date(Date.now() - 25 * 60000).toISOString(),    deal: { dealCode: 'MGNT-2025-001' }, prevSnapshot: null,                        nextSnapshot: null },
  { id: 'l3', action: 'CREATE',             entityType: 'Deal',     description: '핀테크 플랫폼 딜 신규 등록',        user: { name: '박도현' }, createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),   deal: { dealCode: 'MGNT-2025-004' }, prevSnapshot: null,                        nextSnapshot: { dealType: 'FUNDRAISING' } },
  { id: 'l4', action: 'UPDATE',             entityType: 'Deal',     description: '부동산 리츠 목표금액 수정',          user: { name: '이서연' }, createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),   deal: { dealCode: 'MGNT-2025-005' }, prevSnapshot: { targetAmount: 40000 },     nextSnapshot: { targetAmount: 50000 } },
]

// ── 유틸 함수 ─────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return '방금 전'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

function formatAmount(amount: number | null): string {
  if (!amount) return '금액 미정'
  if (amount >= 100000) return `₩${(amount / 100000).toFixed(1)}T`
  if (amount >= 1000)   return `₩${(amount / 1000).toFixed(1)}B`
  return `₩${amount.toLocaleString()}M`
}

function dueDateColor(date: string | null): string {
  if (!date) return '#9CA3AF'
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  if (days < 0)  return '#EF4444'
  if (days <= 7) return '#F59E0B'
  return '#9CA3AF'
}

// ── Avatar 컴포넌트 ───────────────────────────────────────
function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: BRAND.charcoal, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.38, fontWeight: 700, color: 'white' }}>{name?.charAt(0)}</span>
    </div>
  )
}

// ── DealCard 컴포넌트 ─────────────────────────────────────
function DealCard({ deal }: { deal: Deal }) {
  const tm = DEAL_TYPE_META[deal.dealType] || DEAL_TYPE_META.FUNDRAISING
  const dColor = dueDateColor(deal.dueDate)

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('dealId', deal.id)}
      style={{ background: 'white', border: `1px solid ${BRAND.lightGray}`, borderRadius: 10, padding: 12, cursor: 'grab', userSelect: 'none', marginBottom: 8 }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(196,18,48,0.12)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(196,18,48,0.3)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = BRAND.lightGray }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ background: tm.bg, color: tm.text, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>{tm.label}</span>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#9CA3AF' }}>
          {deal._count.documents > 0 && <span>📄 {deal._count.documents}</span>}
          {deal._count.investorMatches > 0 && <span>🎯 {deal._count.investorMatches}</span>}
        </div>
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, color: BRAND.charcoal, margin: '0 0 2px', lineHeight: 1.3 }}>{deal.title}</p>
      <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 10px' }}>{deal.company.name}</p>
      <div style={{ height: 1, background: `linear-gradient(to right, rgba(196,18,48,0.2), ${BRAND.lightGray}, transparent)`, marginBottom: 10 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 2px' }}>Target</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: BRAND.crimson, margin: 0 }}>{formatAmount(deal.targetAmount)}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {deal.dueDate && <span style={{ fontSize: 10, fontWeight: 600, color: dColor }}>{new Date(deal.dueDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>}
          <div style={{ display: 'flex' }}>
            {deal.assignees.slice(0, 3).map((a, i) => (
              <div key={a.user.id} style={{ marginLeft: i > 0 ? -6 : 0 }}>
                <Avatar name={a.user.name} size={22} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── KanbanColumn 컴포넌트 ─────────────────────────────────
function KanbanColumn({ stage, deals, onDrop, onDragOver, onDragLeave, isOver }: {
  stage: typeof STAGES[0]
  deals: Deal[]
  onDrop: (stageId: string, dealId: string) => void
  onDragOver: (stageId: string) => void
  onDragLeave: () => void
  isOver: boolean
}) {
  return (
    <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: stage.color, display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: BRAND.charcoal }}>{stage.label}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#F4F4F6', borderRadius: 20, padding: '1px 8px' }}>{deals.length}</span>
      </div>
      <div
        onDragOver={e => { e.preventDefault(); onDragOver(stage.id) }}
        onDragLeave={onDragLeave}
        onDrop={e => { e.preventDefault(); onDrop(stage.id, e.dataTransfer.getData('dealId')) }}
        style={{ flex: 1, borderRadius: 12, padding: 8, minHeight: 120, background: isOver ? 'rgba(196,18,48,0.06)' : '#F4F4F6', border: isOver ? '1px dashed rgba(196,18,48,0.4)' : '1px solid transparent', transition: 'background 0.15s' }}
      >
        {deals.map(deal => <DealCard key={deal.id} deal={deal} />)}
        {deals.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, color: '#D1D5DB', fontSize: 11 }}>딜 없음</div>
        )}
      </div>
    </div>
  )
}

// ── LogItem 컴포넌트 ──────────────────────────────────────
function LogItem({ log, isNew }: { log: Log; isNew: boolean }) {
  const style = ACTION_STYLE[log.action] || ACTION_STYLE.UPDATE
  const diffKeys = log.prevSnapshot && log.nextSnapshot
    ? Object.keys(log.nextSnapshot).filter(k => JSON.stringify(log.prevSnapshot![k]) !== JSON.stringify(log.nextSnapshot![k]))
    : []

  return (
    <div style={{ display: 'flex', gap: 10, paddingBottom: 14, paddingLeft: 2, animation: isNew ? 'slideIn 0.35s ease-out' : 'none' }}>
      <div style={{ zIndex: 1, marginTop: 3, width: 18, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: style.dot, display: 'block', transform: isNew ? 'scale(1.4)' : 'scale(1)', transition: 'transform 0.2s' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {log.deal && <span style={{ fontSize: 9, fontWeight: 700, color: BRAND.crimson, textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 2 }}>{log.deal.dealCode}</span>}
        <span style={{ display: 'inline-block', background: `${style.dot}18`, color: style.dot, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginBottom: 4 }}>{style.icon} {style.label}</span>
        {log.description && <p style={{ fontSize: 11, color: BRAND.gray, lineHeight: 1.6, margin: '0 0 4px' }}>{log.description}</p>}
        {diffKeys.slice(0, 2).map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F9F9FB', borderRadius: 4, padding: '2px 6px', marginBottom: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#9CA3AF', width: 56 }}>{k}</span>
            <span style={{ fontSize: 10, color: '#9CA3AF', textDecoration: 'line-through' }}>{String(log.prevSnapshot![k]).slice(0, 12)}</span>
            <span style={{ fontSize: 9, color: '#D1D5DB' }}>→</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: BRAND.charcoal }}>{String(log.nextSnapshot![k]).slice(0, 12)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Avatar name={log.user.name} size={16} />
          <span style={{ fontSize: 10, color: '#9CA3AF' }}><span style={{ fontWeight: 600, color: '#6B7280' }}>{log.user.name}</span> · {relativeTime(log.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

// ── NewDealModal 컴포넌트 ─────────────────────────────────
function NewDealModal({ onClose, onAdd }: { onClose: () => void; onAdd: (deal: Deal) => void }) {
  const [title, setTitle]       = useState('')
  const [company, setCompany]   = useState('')
  const [dealType, setDealType] = useState('FUNDRAISING')
  const [amount, setAmount]     = useState('')
  const [stage, setStage]       = useState('SOURCING')

  const submit = () => {
    if (!title || !company) return
    onAdd({
      id: `d${Date.now()}`,
      dealCode: `MGNT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
      title, dealType, stage, status: 'ACTIVE',
      targetAmount: Number(amount) || null,
      company: { name: company, industry: '' },
      assignees: [], dueDate: null,
      _count: { documents: 0, investorMatches: 0 },
    })
    onClose()
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${BRAND.lightGray}`, borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 14, width: 420, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: BRAND.charcoal, margin: 0 }}>신규 딜 등록</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>딜 제목 *</label><input style={inp} placeholder="예: 그린에너지 시리즈B 투자유치" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><label style={lbl}>기업명 *</label><input style={inp} placeholder="예: (주)그린에너지" value={company} onChange={e => setCompany(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>딜 유형</label>
              <select style={{ ...inp, background: 'white' }} value={dealType} onChange={e => setDealType(e.target.value)}>
                <option value="FUNDRAISING">투자유치</option>
                <option value="MA_SELL">기업매각</option>
                <option value="MA_BUY">기업인수</option>
                <option value="REAL_ESTATE">부동산</option>
                <option value="DATA_CENTER">데이터센터</option>
              </select>
            </div>
            <div>
              <label style={lbl}>시작 단계</label>
              <select style={{ ...inp, background: 'white' }} value={stage} onChange={e => setStage(e.target.value)}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div><label style={lbl}>목표 금액 (백만원)</label><input style={inp} type="number" placeholder="예: 30000 (= ₩30B)" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, border: `1px solid ${BRAND.lightGray}`, borderRadius: 7, background: 'white', cursor: 'pointer', fontSize: 13 }}>취소</button>
          <button onClick={submit} style={{ flex: 2, padding: 10, border: 'none', borderRadius: 7, background: BRAND.crimson, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>딜 등록</button>
        </div>
      </div>
    </div>
  )
}

// ── AIDraftModal 컴포넌트 ─────────────────────────────────
interface AIDraft {
  headline: string
  overview: string
  investment_highlights: string[]
  deal_structure: string
  why_now: string
}

function AIDraftModal({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [draft, setDraft]     = useState<AIDraft | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1500,
          system: `You are a senior investment banker at MGNT Partners.
Generate a concise IM executive summary in Korean.
Respond ONLY with a JSON object (no markdown, no backticks):
{"headline":"한 문장 핵심 요약","overview":"회사 개요 2~3문장","investment_highlights":["포인트1","포인트2","포인트3"],"deal_structure":"딜 구조 1~2문장","why_now":"지금 투자 이유 1~2문장"}`,
          messages: [{ role: 'user', content: `딜명: ${deal.title}\n기업: ${deal.company.name}\n업종: ${deal.company.industry || '미분류'}\n유형: ${deal.dealType}\n목표금액: ${formatAmount(deal.targetAmount)}\n\nIM Executive Summary를 작성해줘.` }],
        }),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      setDraft(JSON.parse(text.replace(/```json\n?|```\n?/g, '').trim()))
    } catch {
      setError('AI 생성 오류. Anthropic API 키가 필요하거나 네트워크 오류입니다.')
    }
    setLoading(false)
  }, [deal])

  useEffect(() => { generate() }, [generate])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: BRAND.charcoal, padding: '16px 24px', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 9, color: BRAND.crimson, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>AI Document Engine</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{deal.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ height: 3, background: BRAND.crimson }} />
        <div style={{ padding: 24 }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 12 }}>
              <div style={{ width: 36, height: 36, border: `3px solid ${BRAND.lightGray}`, borderTopColor: BRAND.crimson, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13, color: '#6B7280' }}>Claude AI가 IM 초안을 작성 중...</p>
            </div>
          )}
          {error && <div style={{ background: '#FFF0F2', border: '1px solid rgba(196,18,48,0.2)', borderRadius: 8, padding: 16 }}><p style={{ fontSize: 13, color: BRAND.crimson, margin: 0 }}>{error}</p></div>}
          {draft && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ borderLeft: `3px solid ${BRAND.crimson}`, paddingLeft: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: BRAND.charcoal, lineHeight: 1.6, margin: 0 }}>{draft.headline}</p>
              </div>
              <AISection title="회사 개요" content={draft.overview} />
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: BRAND.crimson, textTransform: 'uppercase', letterSpacing: 1.5, margin: '0 0 8px' }}>핵심 투자 포인트</p>
                {draft.investment_highlights?.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: BRAND.crimson, color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                    <p style={{ fontSize: 13, color: BRAND.gray, margin: 0, lineHeight: 1.6 }}>{h}</p>
                  </div>
                ))}
              </div>
              <AISection title="딜 구조" content={draft.deal_structure} />
              <AISection title="지금 투자해야 하는 이유" content={draft.why_now} dark />
              <button onClick={generate} style={{ padding: 10, border: `1px solid ${BRAND.lightGray}`, borderRadius: 7, background: 'white', cursor: 'pointer', fontSize: 13, color: BRAND.gray }}>↻ 재생성</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AISection({ title, content, dark }: { title: string; content: string; dark?: boolean }) {
  return (
    <div style={{ background: dark ? BRAND.charcoal : '#F9F9FB', borderRadius: 8, padding: '12px 14px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: BRAND.crimson, textTransform: 'uppercase', letterSpacing: 1.5, margin: '0 0 6px' }}>{title}</p>
      <p style={{ fontSize: 13, color: dark ? '#E5E5E5' : BRAND.gray, lineHeight: 1.7, margin: 0 }}>{content}</p>
    </div>
  )
}

// ── 메인 App ──────────────────────────────────────────────
export default function MGNTApp() {
  const [deals, setDeals]         = useState<Deal[]>(INITIAL_DEALS)
  const [logs, setLogs]           = useState<Log[]>(INITIAL_LOGS)
  const [overStage, setOverStage] = useState<string | null>(null)
  const [newIds, setNewIds]       = useState<Set<string>>(new Set())
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [aiDeal, setAiDeal]       = useState<Deal | null>(null)

  const addLog = useCallback((log: Omit<Log, 'id' | 'createdAt'>) => {
    const id = `l${Date.now()}`
    setLogs(prev => [{ ...log, id, createdAt: new Date().toISOString() }, ...prev].slice(0, 100))
    setNewIds(ids => new Set([...ids, id]))
    setTimeout(() => setNewIds(ids => { const n = new Set(ids); n.delete(id); return n }), 2500)
  }, [])

  const handleDrop = useCallback((targetStage: string, dealId: string) => {
    setOverStage(null)
    setDeals(prev => {
      const deal = prev.find(d => d.id === dealId)
      if (!deal || deal.stage === targetStage) return prev
      addLog({ action: 'STAGE_CHANGE', entityType: 'Deal', description: `${deal.title} → ${STAGES.find(s => s.id === targetStage)?.label}으로 이동`, user: { name: '나' }, deal: { dealCode: deal.dealCode }, prevSnapshot: { stage: deal.stage }, nextSnapshot: { stage: targetStage } })
      return prev.map(d => d.id === dealId ? { ...d, stage: targetStage } : d)
    })
  }, [addLog])

  const handleAddDeal = useCallback((deal: Deal) => {
    setDeals(prev => [...prev, deal])
    addLog({ action: 'CREATE', entityType: 'Deal', description: `${deal.title} 신규 등록`, user: { name: '나' }, deal: { dealCode: deal.dealCode }, prevSnapshot: null, nextSnapshot: { dealType: deal.dealType } })
  }, [addLog])

  const columns = STAGES.reduce<Record<string, Deal[]>>((acc, s) => ({ ...acc, [s.id]: deals.filter(d => d.stage === s.id) }), {})

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', background: '#F9F9FB', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 2px; }
      `}</style>

      {/* 헤더 */}
      <header style={{ background: 'white', borderBottom: `1px solid ${BRAND.lightGray}`, padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: BRAND.charcoal, letterSpacing: 2 }}>
            <span style={{ color: BRAND.crimson }}>MGNT</span> PARTNERS
          </span>
          <span style={{ width: 1, height: 16, background: BRAND.lightGray }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: BRAND.charcoal }}>Deal Board</span>
          <span style={{ fontSize: 11, background: '#F4F4F6', color: '#6B7280', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>총 {deals.length}건</span>
        </div>
        <button onClick={() => setShowNewDeal(true)} style={{ background: BRAND.crimson, color: 'white', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          + 신규 딜
        </button>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 칸반보드 */}
        <main style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 12, minWidth: 'max-content' }}>
            {STAGES.map(stage => (
              <KanbanColumn key={stage.id} stage={stage} deals={columns[stage.id] || []}
                onDrop={handleDrop} onDragOver={setOverStage} onDragLeave={() => setOverStage(null)} isOver={overStage === stage.id} />
            ))}
          </div>

          {/* AI IM 생성 패널 */}
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'white', borderRadius: 10, border: `1px solid ${BRAND.lightGray}` }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 8px', fontWeight: 600 }}>⬡ AI Document Engine — IM 자동 생성</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {deals.filter(d => ['PREPARATION', 'MARKETING', 'EXECUTION'].includes(d.stage)).map(deal => (
                <button key={deal.id} onClick={() => setAiDeal(deal)}
                  style={{ fontSize: 11, padding: '5px 12px', border: '1px solid rgba(196,18,48,0.3)', borderRadius: 6, background: '#FFF0F2', color: BRAND.crimson, cursor: 'pointer', fontWeight: 600 }}>
                  {deal.company.name} IM 생성
                </button>
              ))}
              {deals.filter(d => ['PREPARATION', 'MARKETING', 'EXECUTION'].includes(d.stage)).length === 0 && (
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Preparation ~ Execution 단계 딜에서 IM을 생성할 수 있습니다.</p>
              )}
            </div>
          </div>
        </main>

        {/* Activity Log 사이드바 */}
        <aside style={{ width: 260, borderLeft: `1px solid ${BRAND.lightGray}`, background: 'white', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${BRAND.lightGray}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: BRAND.crimson, animation: 'spin 2s linear infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: BRAND.charcoal, textTransform: 'uppercase', letterSpacing: 2 }}>Activity</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', background: '#F4F4F6', borderRadius: 20, padding: '1px 7px', marginLeft: 'auto' }}>{logs.length}</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 11, top: 4, bottom: 4, width: 1, background: 'linear-gradient(to bottom, #E5E5E5, transparent)' }} />
              {logs.map(log => <LogItem key={log.id} log={log} isNew={newIds.has(log.id)} />)}
            </div>
          </div>
        </aside>
      </div>

      {showNewDeal && <NewDealModal onClose={() => setShowNewDeal(false)} onAdd={handleAddDeal} />}
      {aiDeal && <AIDraftModal deal={aiDeal} onClose={() => setAiDeal(null)} />}
    </div>
  )
}