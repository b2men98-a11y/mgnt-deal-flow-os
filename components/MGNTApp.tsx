'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BRAND = { crimson: '#C41230', charcoal: '#1A1A2E', white: '#FFFFFF', gray: '#4A4A4A', lightGray: '#E5E5E5' }
const STAGES = [
  { id: 'SOURCING',    label: 'Sourcing',    color: '#6B7280' },
  { id: 'PREPARATION', label: 'Preparation', color: '#3B82F6' },
  { id: 'MARKETING',  label: 'Marketing',   color: '#8B5CF6' },
  { id: 'EXECUTION',  label: 'Execution',   color: '#F59E0B' },
  { id: 'CLOSING',    label: 'Closing',     color: '#C41230' },
]
const DEAL_TYPE_META: Record<string, { label: string; bg: string; text: string }> = {
  FUNDRAISING: { label: 'Fund', bg: '#EFF6FF', text: '#1D4ED8' },
  MA_SELL:     { label: 'M&A',  bg: '#FFFBEB', text: '#92400E' },
  MA_BUY:      { label: 'Buy',  bg: '#F5F3FF', text: '#5B21B6' },
  REAL_ESTATE: { label: 'RE',   bg: '#ECFDF5', text: '#065F46' },
  DATA_CENTER: { label: 'DC',   bg: '#FFF0F2', text: '#C41230' },
}

interface Deal { id: string; deal_code: string; title: string; deal_type: string; stage: string; status: string; target_amount: number | null; company_name: string; company_industry: string; description: string | null; due_date: string | null; created_at: string }
interface Comment { id: string; deal_id: string; author: string; content: string; created_at: string }
interface DealFile { id: string; deal_id: string; file_name: string; file_url: string; file_type: string; file_size: number; created_at: string }
interface Assignee { id: string; deal_id: string; name: string; role: string; email: string }
interface Investor { id: string; firm_name: string; fund_name: string; fund_size: number; fund_size_unit: string; sectors: string[]; investment_stage: string; contact_name: string; contact_email: string; source_url: string; news_date: string; expires_at: string }
interface Log { id: string; deal_id: string | null; action: string; description: string; author: string; created_at: string }

function relativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime(), s = Math.floor(diff / 1000)
  if (s < 60) return '방금 전'; const m = Math.floor(s / 60); if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`; return `${Math.floor(h / 24)}일 전`
}
function fmt(n: number | null) {
  if (!n) return '미정'; if (n >= 100000) return `₩${(n/100000).toFixed(1)}T`
  if (n >= 1000) return `₩${(n/1000).toFixed(1)}B`; return `₩${n.toLocaleString()}M`
}
function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: BRAND.charcoal, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', flexShrink: 0 }}><span style={{ fontSize: size*0.38, fontWeight: 700, color: 'white' }}>{name?.charAt(0)}</span></div>
}

// ── 딜 카드 ──────────────────────────────────────────────
function DealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const tm = DEAL_TYPE_META[deal.deal_type] || DEAL_TYPE_META.FUNDRAISING
  const days = deal.due_date ? Math.ceil((new Date(deal.due_date).getTime() - Date.now()) / 86400000) : null
  const dc = days === null ? '#9CA3AF' : days < 0 ? '#EF4444' : days <= 7 ? '#F59E0B' : '#9CA3AF'
  return (
    <div draggable onDragStart={e => e.dataTransfer.setData('dealId', deal.id)} onClick={onClick}
      style={{ background: 'white', border: `1px solid ${BRAND.lightGray}`, borderRadius: 10, padding: 12, cursor: 'pointer', userSelect: 'none', marginBottom: 8, transition: 'all 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(196,18,48,0.12)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(196,18,48,0.3)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = BRAND.lightGray }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ background: tm.bg, color: tm.text, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>{tm.label}</span>
        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{deal.deal_code}</span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: BRAND.charcoal, margin: '0 0 2px', lineHeight: 1.3 }}>{deal.title}</p>
      <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 8px' }}>{deal.company_name}</p>
      <div style={{ height: 1, background: `linear-gradient(to right,rgba(196,18,48,0.2),${BRAND.lightGray},transparent)`, marginBottom: 8 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: BRAND.crimson, margin: 0 }}>{fmt(deal.target_amount)}</p>
        {days !== null && <span style={{ fontSize: 10, fontWeight: 600, color: dc }}>{new Date(deal.due_date!).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>}
      </div>
    </div>
  )
}

// ── 칸반 컬럼 ─────────────────────────────────────────────
function KanbanColumn({ stage, deals, onDrop, onDragOver, onDragLeave, isOver, onCardClick }: { stage: typeof STAGES[0]; deals: Deal[]; onDrop: (s: string, id: string) => void; onDragOver: (s: string) => void; onDragLeave: () => void; isOver: boolean; onCardClick: (d: Deal) => void }) {
  return (
    <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: stage.color, display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: BRAND.charcoal }}>{stage.label}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#F4F4F6', borderRadius: 20, padding: '1px 8px' }}>{deals.length}</span>
      </div>
      <div onDragOver={e => { e.preventDefault(); onDragOver(stage.id) }} onDragLeave={onDragLeave} onDrop={e => { e.preventDefault(); onDrop(stage.id, e.dataTransfer.getData('dealId')) }}
        style={{ flex: 1, borderRadius: 12, padding: 8, minHeight: 120, background: isOver ? 'rgba(196,18,48,0.06)' : '#F4F4F6', border: isOver ? '1px dashed rgba(196,18,48,0.4)' : '1px solid transparent', transition: 'all 0.15s' }}>
        {deals.map(d => <DealCard key={d.id} deal={d} onClick={() => onCardClick(d)} />)}
        {deals.length === 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, color: '#D1D5DB', fontSize: 11 }}>딜 없음</div>}
      </div>
    </div>
  )
}

// ── 딜 상세 패널 ─────────────────────────────────────────
function DealDetailPanel({ deal, onClose, onUpdate }: { deal: Deal; onClose: () => void; onUpdate: () => void }) {
  const [tab, setTab] = useState<'overview'|'comments'|'files'|'assignees'|'ai'>('overview')
  const [comments, setComments] = useState<Comment[]>([])
  const [files, setFiles] = useState<DealFile[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [newComment, setNewComment] = useState('')
  const [newAssignee, setNewAssignee] = useState({ name:'', role:'', email:'' })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDraft, setAiDraft] = useState<string|null>(null)
  const [uploading, setUploading] = useState(false)
  const [editDesc, setEditDesc] = useState(deal.description || '')

  useEffect(() => {
    supabase.from('comments').select('*').eq('deal_id', deal.id).order('created_at',{ascending:false}).then(({data})=>setComments(data||[]))
    supabase.from('deal_files').select('*').eq('deal_id', deal.id).order('created_at',{ascending:false}).then(({data})=>setFiles(data||[]))
    supabase.from('assignees').select('*').eq('deal_id', deal.id).then(({data})=>setAssignees(data||[]))
  }, [deal.id])

  const addComment = async () => {
    if (!newComment.trim()) return
    const { data } = await supabase.from('comments').insert({ deal_id: deal.id, author: '나', content: newComment }).select().single()
    if (data) { setComments(p => [data, ...p]); setNewComment('') }
    await supabase.from('activity_logs').insert({ deal_id: deal.id, action: 'UPDATE', description: `코멘트: "${newComment.slice(0,30)}"`, author: '나' })
  }

  const addAssignee = async () => {
    if (!newAssignee.name.trim()) return
    const { data } = await supabase.from('assignees').insert({ deal_id: deal.id, ...newAssignee }).select().single()
    if (data) { setAssignees(p => [...p, data]); setNewAssignee({ name:'', role:'', email:'' }) }
  }

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const path = `deals/${deal.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('deal-files').upload(path, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('deal-files').getPublicUrl(path)
      const { data } = await supabase.from('deal_files').insert({ deal_id: deal.id, file_name: file.name, file_url: urlData.publicUrl, file_type: file.type, file_size: file.size }).select().single()
      if (data) setFiles(p => [data, ...p])
      await supabase.from('activity_logs').insert({ deal_id: deal.id, action: 'UPDATE', description: `파일 업로드: ${file.name}`, author: '나' })
    }
    setUploading(false); e.target.value = ''
  }

  const saveDesc = async () => {
    await supabase.from('deals').update({ description: editDesc, updated_at: new Date().toISOString() }).eq('id', deal.id)
    onUpdate()
  }

  const generateAI = async (docType: string) => {
    setAiLoading(true); setAiDraft(null); setTab('ai')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 2000,
          system: `You are a senior investment banker at MGNT Partners. Generate professional ${docType} in Korean. Be thorough and impactful.`,
          messages: [{ role: 'user', content: `딜명: ${deal.title}\n기업: ${deal.company_name}\n업종: ${deal.company_industry}\n유형: ${deal.deal_type}\n목표금액: ${fmt(deal.target_amount)}\n설명: ${deal.description||'없음'}\n\n${docType}를 작성해줘.` }] })
      })
      const d = await res.json()
      setAiDraft(d.content?.[0]?.text || 'API 키가 필요합니다.')
    } catch { setAiDraft('오류. Anthropic API 키를 확인해주세요.') }
    setAiLoading(false)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${BRAND.lightGray}`, borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
  const tabBtn = (t: string, label: string) => (
    <button key={t} onClick={() => setTab(t as typeof tab)}
      style={{ padding: '8px 12px', fontSize: 12, fontWeight: tab===t ? 700 : 400, color: tab===t ? BRAND.crimson : '#6B7280', background: 'none', border: 'none', borderBottom: tab===t ? `2px solid ${BRAND.crimson}` : '2px solid transparent', cursor: 'pointer' }}>
      {label}
    </button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 560, background: 'white', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: BRAND.charcoal, padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 9, color: BRAND.crimson, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>{deal.deal_code}</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: '4px 0 4px' }}>{deal.title}</h2>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>{deal.company_name} · {deal.company_industry}</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(196,18,48,0.2)', color: BRAND.crimson, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>{fmt(deal.target_amount)}</span>
            <span style={{ background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>{STAGES.find(s => s.id === deal.stage)?.label}</span>
          </div>
        </div>
        <div style={{ height: 3, background: BRAND.crimson, flexShrink: 0 }} />

        {/* AI 문서 생성 버튼 */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${BRAND.lightGray}`, display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0, background: '#FAFAFA' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', alignSelf: 'center', marginRight: 4 }}>AI 생성:</span>
          {['IM', '티저', 'NDA', 'LOI', 'MOU'].map(doc => (
            <button key={doc} onClick={() => generateAI(doc)}
              style={{ fontSize: 11, padding: '4px 10px', border: `1px solid rgba(196,18,48,0.3)`, borderRadius: 6, background: '#FFF0F2', color: BRAND.crimson, cursor: 'pointer', fontWeight: 600 }}>
              {doc}
            </button>
          ))}
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${BRAND.lightGray}`, padding: '0 8px', flexShrink: 0 }}>
          {[['overview','개요'],['comments','코멘트'],['files','파일'],['assignees','담당자'],['ai','AI 문서']].map(([t,l]) => tabBtn(t, l))}
        </div>

        <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: BRAND.crimson, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>딜 메모</p>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ ...inp, minHeight: 100, resize: 'vertical' }} placeholder="메모, 특이사항, 전략 등..." />
                <button onClick={saveDesc} style={{ marginTop: 6, padding: '6px 14px', background: BRAND.crimson, color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>저장</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['딜 유형', deal.deal_type],['현재 단계', deal.stage],['목표 금액', fmt(deal.target_amount)],['등록일', new Date(deal.created_at).toLocaleDateString('ko-KR')]].map(([k,v]) => (
                  <div key={k} style={{ background: '#F9F9FB', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.8 }}>{k}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: BRAND.charcoal, margin: 0 }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'comments' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input style={{ ...inp, flex: 1 }} placeholder="코멘트 입력..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} />
                <button onClick={addComment} style={{ padding: '8px 14px', background: BRAND.crimson, color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>추가</button>
              </div>
              {comments.length === 0 && <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>코멘트가 없습니다</p>}
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <Avatar name={c.author} size={28} />
                  <div style={{ flex: 1, background: '#F9F9FB', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: BRAND.charcoal }}>{c.author}</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>{relativeTime(c.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: BRAND.gray, margin: 0, lineHeight: 1.6 }}>{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === 'files' && (
            <div>
              <label style={{ display: 'block', marginBottom: 16 }}>
                <div style={{ border: `2px dashed rgba(196,18,48,0.3)`, borderRadius: 8, padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#FFF8F8' }}>
                  <p style={{ fontSize: 13, color: BRAND.crimson, fontWeight: 600, margin: 0 }}>{uploading ? '업로드 중...' : '📁 파일 업로드'}</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>PDF, DOCX, XLSX, PNG 등</p>
                </div>
                <input type="file" style={{ display: 'none' }} onChange={uploadFile} />
              </label>
              {files.length === 0 && <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>업로드된 파일이 없습니다</p>}
              {files.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: `1px solid ${BRAND.lightGray}`, borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{f.file_type?.includes('pdf') ? '📄' : f.file_type?.includes('image') ? '🖼️' : '📎'}</span>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: BRAND.charcoal, margin: 0 }}>{f.file_name}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>{(f.file_size/1024).toFixed(0)}KB · {relativeTime(f.created_at)}</p>
                    </div>
                  </div>
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: BRAND.crimson, fontWeight: 600, textDecoration: 'none', padding: '4px 10px', border: `1px solid rgba(196,18,48,0.3)`, borderRadius: 5 }}>열기</a>
                </div>
              ))}
            </div>
          )}
          {tab === 'assignees' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 16 }}>
                <input style={inp} placeholder="이름" value={newAssignee.name} onChange={e => setNewAssignee(p => ({...p, name: e.target.value}))} />
                <input style={inp} placeholder="역할" value={newAssignee.role} onChange={e => setNewAssignee(p => ({...p, role: e.target.value}))} />
                <input style={inp} placeholder="이메일" value={newAssignee.email} onChange={e => setNewAssignee(p => ({...p, email: e.target.value}))} />
                <button onClick={addAssignee} style={{ padding: '8px 12px', background: BRAND.crimson, color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>추가</button>
              </div>
              {assignees.length === 0 && <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>등록된 담당자가 없습니다</p>}
              {assignees.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${BRAND.lightGray}`, borderRadius: 8, marginBottom: 8 }}>
                  <Avatar name={a.name} size={32} />
                  <div><p style={{ fontSize: 13, fontWeight: 600, color: BRAND.charcoal, margin: 0 }}>{a.name}</p><p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{a.role}{a.email ? ` · ${a.email}` : ''}</p></div>
                </div>
              ))}
            </div>
          )}
          {tab === 'ai' && (
            <div>
              {aiLoading && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 12 }}><div style={{ width: 36, height: 36, border: `3px solid ${BRAND.lightGray}`, borderTopColor: BRAND.crimson, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><p style={{ fontSize: 13, color: '#6B7280' }}>Claude AI 작성 중...</p></div>}
              {!aiLoading && !aiDraft && <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '40px 0' }}>상단 버튼으로 문서를 생성하세요</p>}
              {aiDraft && !aiLoading && (
                <div>
                  <div style={{ background: '#F9F9FB', borderRadius: 8, padding: 16, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.8, color: BRAND.gray }}>{aiDraft}</div>
                  <button onClick={() => navigator.clipboard.writeText(aiDraft)} style={{ marginTop: 12, padding: '8px 16px', border: `1px solid ${BRAND.lightGray}`, borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 12 }}>📋 복사</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 투자자 DB 패널 ────────────────────────────────────────
function InvestorDBPanel({ onClose }: { onClose: () => void }) {
  const [investors, setInvestors] = useState<Investor[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => { supabase.from('investors').select('*').order('created_at',{ascending:false}).then(({data}) => { setInvestors(data||[]); setLoading(false) }) }, [])

  const autoSearch = async () => {
    setSearching(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 3000,
          system: `Korean PE/VC researcher. Return ONLY JSON array (no markdown): [{"firm_name":"운용사","fund_name":"펀드명","fund_size":숫자,"fund_size_unit":"억원","sectors":["섹터"],"investment_stage":"단계","contact_name":"담당자","contact_email":"이메일","source_url":"URL","news_date":"YYYY-MM-DD"}]`,
          messages: [{ role: 'user', content: `최근 1년 국내 블라인드 펀드 결성 현황 8~10개. ${q ? `${q} 관련 위주.` : 'PE, VC, 부동산, 인프라, 데이터센터 포함.'}` }] })
      })
      const d = await res.json()
      const newInv = JSON.parse((d.content?.[0]?.text||'[]').replace(/```json\n?|```\n?/g,'').trim())
      for (const inv of newInv) {
        const exp = new Date(); exp.setFullYear(exp.getFullYear()+2)
        await supabase.from('investors').upsert({...inv, expires_at: exp.toISOString().split('T')[0]}, {onConflict:'firm_name'})
      }
      const { data } = await supabase.from('investors').select('*').order('created_at',{ascending:false})
      setInvestors(data||[])
    } catch { alert('Anthropic API 키를 확인해주세요.') }
    setSearching(false)
  }

  const filtered = investors.filter(inv => !q || inv.firm_name?.includes(q) || inv.fund_name?.includes(q) || inv.sectors?.some(s => s.includes(q)))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 620, background: 'white', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: BRAND.charcoal, padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><span style={{ fontSize: 9, color: BRAND.crimson, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>Investor Database</span><h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: '4px 0 0' }}>투자자 DB <span style={{ fontSize: 12, fontWeight: 400, color: '#9CA3AF' }}>({investors.length}개 · 2년 자동 만료)</span></h2></div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>
        </div>
        <div style={{ height: 3, background: BRAND.crimson, flexShrink: 0 }} />
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BRAND.lightGray}`, display: 'flex', gap: 8, flexShrink: 0 }}>
          <input style={{ flex: 1, padding: '8px 12px', border: `1px solid ${BRAND.lightGray}`, borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} placeholder="운용사, 펀드명, 섹터 검색..." value={q} onChange={e => setQ(e.target.value)} />
          <button onClick={autoSearch} disabled={searching} style={{ padding: '8px 14px', background: BRAND.crimson, color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {searching ? '수집 중...' : '⬡ AI 자동 수집'}
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>로딩 중...</p>}
          {!loading && filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0' }}><p style={{ fontSize: 13, color: '#9CA3AF' }}>투자자 DB가 비어있습니다</p><p style={{ fontSize: 12, color: '#9CA3AF' }}>AI 자동 수집 버튼으로 최신 펀드를 불러오세요</p></div>}
          {filtered.map(inv => (
            <div key={inv.id} style={{ border: `1px solid ${BRAND.lightGray}`, borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div><p style={{ fontSize: 13, fontWeight: 700, color: BRAND.charcoal, margin: 0 }}>{inv.firm_name}</p><p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>{inv.fund_name}</p></div>
                {inv.fund_size && <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.crimson }}>{inv.fund_size.toLocaleString()}{inv.fund_size_unit}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {inv.sectors?.map((s,i) => <span key={i} style={{ fontSize: 10, background: '#F0F4FF', color: '#3B82F6', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{s}</span>)}
                {inv.investment_stage && <span style={{ fontSize: 10, background: '#F9F9FB', color: '#6B7280', padding: '2px 8px', borderRadius: 20 }}>{inv.investment_stage}</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{inv.contact_name}{inv.contact_email ? ` · ${inv.contact_email}` : ''}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {inv.news_date && <span style={{ fontSize: 10, color: '#9CA3AF' }}>{inv.news_date}</span>}
                  {inv.source_url && <a href={inv.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: BRAND.crimson, fontWeight: 600, textDecoration: 'none' }}>출처 →</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 신규 딜 모달 ──────────────────────────────────────────
function NewDealModal({ onClose, onAdd }: { onClose: () => void; onAdd: () => void }) {
  const [form, setForm] = useState({ title:'', company_name:'', company_industry:'', deal_type:'FUNDRAISING', stage:'SOURCING', target_amount:'' })
  const set = (k: string, v: string) => setForm(p => ({...p, [k]: v}))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${BRAND.lightGray}`, borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }

  const submit = async () => {
    if (!form.title || !form.company_name) return
    const year = new Date().getFullYear()
    const { count } = await supabase.from('deals').select('*', { count: 'exact', head: true })
    const dealCode = `MGNT-${year}-${String((count||0)+1).padStart(3,'0')}`
    const { data } = await supabase.from('deals').insert({ deal_code: dealCode, title: form.title, deal_type: form.deal_type, stage: form.stage, target_amount: Number(form.target_amount)||null, company_name: form.company_name, company_industry: form.company_industry }).select().single()
    if (data) { await supabase.from('activity_logs').insert({ deal_id: data.id, action: 'CREATE', description: `${form.title} 신규 등록`, author: '나' }); onAdd(); onClose() }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 14, width: 440, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2 style={{ fontSize: 16, fontWeight: 700, color: BRAND.charcoal, margin: 0 }}>신규 딜 등록</h2><button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>×</button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>딜 제목 *</label><input style={inp} placeholder="그린에너지 시리즈B 투자유치" value={form.title} onChange={e => set('title', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>기업명 *</label><input style={inp} value={form.company_name} onChange={e => set('company_name', e.target.value)} /></div>
            <div><label style={lbl}>업종</label><input style={inp} placeholder="클린테크" value={form.company_industry} onChange={e => set('company_industry', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>딜 유형</label>
              <select style={{ ...inp, background: 'white' }} value={form.deal_type} onChange={e => set('deal_type', e.target.value)}>
                <option value="FUNDRAISING">투자유치</option><option value="MA_SELL">기업매각</option><option value="MA_BUY">기업인수</option><option value="REAL_ESTATE">부동산</option><option value="DATA_CENTER">데이터센터</option>
              </select>
            </div>
            <div><label style={lbl}>시작 단계</label>
              <select style={{ ...inp, background: 'white' }} value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div><label style={lbl}>목표 금액 (백만원)</label><input style={inp} type="number" placeholder="30000 = ₩30B" value={form.target_amount} onChange={e => set('target_amount', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, border: `1px solid ${BRAND.lightGray}`, borderRadius: 7, background: 'white', cursor: 'pointer', fontSize: 13 }}>취소</button>
          <button onClick={submit} style={{ flex: 2, padding: 10, border: 'none', borderRadius: 7, background: BRAND.crimson, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>딜 등록</button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 앱 ──────────────────────────────────────────────
export default function MGNTApp() {
  const [deals, setDeals]     = useState<Deal[]>([])
  const [logs, setLogs]       = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [overStage, setOverStage]   = useState<string|null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal|null>(null)
  const [showNewDeal, setShowNewDeal]   = useState(false)
  const [showInvestors, setShowInvestors] = useState(false)

  const loadData = useCallback(async () => {
    const [{ data: d }, { data: l }] = await Promise.all([
      supabase.from('deals').select('*').neq('status','ARCHIVED').order('created_at',{ascending:false}),
      supabase.from('activity_logs').select('*').order('created_at',{ascending:false}).limit(50)
    ])
    setDeals(d||[]); setLogs(l||[]); setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const ch = supabase.channel('board')
      .on('postgres_changes',{event:'*',schema:'public',table:'deals'},()=>loadData())
      .on('postgres_changes',{event:'*',schema:'public',table:'activity_logs'},()=>loadData())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadData])

  const handleDrop = useCallback(async (targetStage: string, dealId: string) => {
    setOverStage(null)
    const deal = deals.find(d => d.id === dealId)
    if (!deal || deal.stage === targetStage) return
    setDeals(p => p.map(d => d.id === dealId ? {...d, stage: targetStage} : d))
    await supabase.from('deals').update({ stage: targetStage, updated_at: new Date().toISOString() }).eq('id', dealId)
    await supabase.from('activity_logs').insert({ deal_id: dealId, action: 'STAGE_CHANGE', description: `${deal.title} → ${STAGES.find(s=>s.id===targetStage)?.label}으로 이동`, author: '나' })
  }, [deals])

  const columns = STAGES.reduce<Record<string,Deal[]>>((acc,s) => ({...acc, [s.id]: deals.filter(d=>d.stage===s.id)}), {})

  if (loading) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'#F9F9FB' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:`3px solid #E5E5E5`, borderTopColor:BRAND.crimson, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ fontSize:13, color:'#6B7280' }}>Supabase에서 데이터 로딩 중...</p>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', height:'100vh', flexDirection:'column', background:'#F9F9FB', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:2px}`}</style>

      <header style={{ background:'white', borderBottom:`1px solid ${BRAND.lightGray}`, padding:'0 20px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:16, fontWeight:700, color:BRAND.charcoal, letterSpacing:2 }}><span style={{ color:BRAND.crimson }}>MGNT</span> PARTNERS</span>
          <span style={{ width:1, height:16, background:BRAND.lightGray }} />
          <span style={{ fontSize:14, fontWeight:600, color:BRAND.charcoal }}>Deal Board</span>
          <span style={{ fontSize:11, background:'#F4F4F6', color:'#6B7280', borderRadius:20, padding:'2px 10px', fontWeight:600 }}>총 {deals.length}건</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setShowInvestors(true)} style={{ padding:'8px 14px', border:`1px solid rgba(196,18,48,0.3)`, borderRadius:7, background:'#FFF0F2', color:BRAND.crimson, fontSize:12, fontWeight:600, cursor:'pointer' }}>👥 투자자 DB</button>
          <button onClick={() => setShowNewDeal(true)} style={{ background:BRAND.crimson, color:'white', border:'none', borderRadius:7, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer' }}>+ 신규 딜</button>
        </div>
      </header>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <main style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
          <div style={{ display:'flex', gap:12, minWidth:'max-content' }}>
            {STAGES.map(stage => <KanbanColumn key={stage.id} stage={stage} deals={columns[stage.id]||[]} onDrop={handleDrop} onDragOver={setOverStage} onDragLeave={() => setOverStage(null)} isOver={overStage===stage.id} onCardClick={setSelectedDeal} />)}
          </div>
        </main>
        <aside style={{ width:252, borderLeft:`1px solid ${BRAND.lightGray}`, background:'white', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 14px 10px', borderBottom:`1px solid ${BRAND.lightGray}`, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:BRAND.crimson, display:'inline-block' }} />
            <span style={{ fontSize:11, fontWeight:700, color:BRAND.charcoal, textTransform:'uppercase', letterSpacing:2 }}>Activity</span>
            <span style={{ fontSize:10, fontWeight:600, color:'#6B7280', background:'#F4F4F6', borderRadius:20, padding:'1px 7px', marginLeft:'auto' }}>{logs.length}</span>
          </div>
          <div style={{ flex:1, overflow:'auto', padding:'12px 14px' }}>
            <div style={{ position:'relative' }}>
              <div style={{ position:'absolute', left:11, top:4, bottom:4, width:1, background:'linear-gradient(to bottom,#E5E5E5,transparent)' }} />
              {logs.map(log => (
                <div key={log.id} style={{ display:'flex', gap:10, paddingBottom:12, paddingLeft:2 }}>
                  <span style={{ width:9, height:9, borderRadius:'50%', background: log.action==='CREATE'?'#10B981':log.action==='DELETE'?'#EF4444':log.action==='STAGE_CHANGE'?'#8B5CF6':'#3B82F6', display:'block', marginTop:3, flexShrink:0, zIndex:1 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:11, color:BRAND.gray, lineHeight:1.5, margin:'0 0 3px' }}>{log.description}</p>
                    <span style={{ fontSize:10, color:'#9CA3AF' }}>{log.author} · {relativeTime(log.created_at)}</span>
                  </div>
                </div>
              ))}
              {logs.length === 0 && <p style={{ fontSize:11, color:'#9CA3AF', textAlign:'center', padding:'20px 0' }}>활동 내역 없음</p>}
            </div>
          </div>
        </aside>
      </div>

      {selectedDeal && <DealDetailPanel deal={selectedDeal} onClose={() => setSelectedDeal(null)} onUpdate={loadData} />}
      {showNewDeal && <NewDealModal onClose={() => setShowNewDeal(false)} onAdd={loadData} />}
      {showInvestors && <InvestorDBPanel onClose={() => setShowInvestors(false)} />}
    </div>
  )
}
