import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const DOC_CATEGORIES = [
  { id: 'legal',       label: 'Legal Documents',     emoji: '📜' },
  { id: 'insurance',   label: 'Insurance',           emoji: '🛡️' },
  { id: 'medical',     label: 'Medical Records',     emoji: '🏥' },
  { id: 'medication',  label: 'Medications',         emoji: '💊' },
  { id: 'contacts',    label: 'Emergency Contacts',  emoji: '📞' },
  { id: 'lab_results', label: 'Lab Results',         emoji: '🔬' },
]

const COLORS = ['#6B8F71','#D4956A','#63B3ED','#B794F4','#FC8181','#68D391','#F6AD55','#4FD1C5']

function TrendChart({ trendData }) {
  const [activeMetric, setActiveMetric] = useState(null)
  if (!trendData?.metrics?.length || !trendData?.dates?.length) return null
  const metrics = trendData.metrics
  const dates = trendData.dates
  const displayMetrics = activeMetric ? metrics.filter(m => m.name === activeMetric) : metrics

  const allValues = metrics.flatMap(m => m.values.filter(v => v !== null))
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const range = maxVal - minVal || 1

  const W = 600, H = 220, PL = 0, PR = 20, PT = 20, PB = 40
  const chartW = W - PL - PR
  const chartH = H - PT - PB
  const xStep = dates.length > 1 ? chartW / (dates.length - 1) : chartW / 2

  const toX = (i) => PL + (dates.length > 1 ? i * xStep : chartW / 2)
  const toY = (v) => PT + chartH - ((v - minVal) / range) * chartH

  return (
    <div>
      {/* Metric filter pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setActiveMetric(null)} style={{ padding: '4px 12px', borderRadius: 20, border: '1.5px solid', borderColor: !activeMetric ? 'var(--sage)' : 'var(--border)', background: !activeMetric ? 'var(--sage-light)' : 'white', color: !activeMetric ? 'var(--sage-dark)' : 'var(--slate)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>All</button>
        {metrics.map((m, i) => (
          <button key={m.name} onClick={() => setActiveMetric(m.name === activeMetric ? null : m.name)} style={{ padding: '4px 12px', borderRadius: 20, border: '1.5px solid', borderColor: activeMetric === m.name ? COLORS[i % COLORS.length] : 'var(--border)', background: activeMetric === m.name ? COLORS[i % COLORS.length] + '22' : 'white', color: activeMetric === m.name ? COLORS[i % COLORS.length] : 'var(--slate)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{m.name}</button>
        ))}
      </div>

      {/* SVG Line Chart */}
      <div style={{ overflowX: 'auto', marginBottom: 20 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 320, fontFamily: 'var(--font-body)' }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => {
            const y = PT + chartH * (1 - t)
            const val = (minVal + range * t).toFixed(1)
            return (
              <g key={t}>
                <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#E8E2D9" strokeWidth="1" />
                <text x={PL + 2} y={y - 3} fontSize="9" fill="#718096">{val}</text>
              </g>
            )
          })}

          {/* X axis labels */}
          {dates.map((d, i) => (
            <text key={i} x={toX(i)} y={H - 5} fontSize="9" fill="#718096" textAnchor="middle">{d}</text>
          ))}

          {/* Lines + dots per metric */}
          {displayMetrics.map((m, mi) => {
            const color = COLORS[metrics.findIndex(x => x.name === m.name) % COLORS.length]
            const points = m.values.map((v, i) => v !== null ? { x: toX(i), y: toY(v), v } : null)
            const validPoints = points.filter(Boolean)
            if (!validPoints.length) return null

            // Build path skipping nulls
            let d = ''
            points.forEach((p, i) => {
              if (!p) return
              const prev = points.slice(0, i).reverse().find(Boolean)
              d += prev ? `L${p.x},${p.y}` : `M${p.x},${p.y}`
            })

            // Reference range band
            const refLines = []
            if (m.low !== undefined && m.high !== undefined) {
              refLines.push(
                <rect key="band" x={PL} y={toY(m.high)} width={chartW} height={toY(m.low) - toY(m.high)} fill={color} opacity="0.07" />,
                <line key="low" x1={PL} y1={toY(m.low)} x2={W - PR} y2={toY(m.low)} stroke={color} strokeWidth="0.8" strokeDasharray="4,3" opacity="0.5" />,
                <line key="high" x1={PL} y1={toY(m.high)} x2={W - PR} y2={toY(m.high)} stroke={color} strokeWidth="0.8" strokeDasharray="4,3" opacity="0.5" />
              )
            }

            return (
              <g key={m.name}>
                {refLines}
                <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                {validPoints.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="white" strokeWidth="1.5" />
                    <text x={p.x} y={p.y - 8} fontSize="8.5" fill={color} textAnchor="middle" fontWeight="600">{p.v}{m.unit ? ' ' + m.unit : ''}</text>
                  </g>
                ))}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Data table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'var(--navy)' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', color: 'white', fontWeight: 600, borderRadius: '6px 0 0 0', whiteSpace: 'nowrap' }}>Test / Metric</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontWeight: 500 }}>Normal Range</th>
              {dates.map((d, i) => (
                <th key={i} style={{ padding: '10px 12px', textAlign: 'center', color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>{d}</th>
              ))}
              <th style={{ padding: '10px 14px', textAlign: 'center', color: 'white', fontWeight: 600, borderRadius: '0 6px 0 0' }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, mi) => {
              const color = COLORS[mi % COLORS.length]
              const validVals = m.values.filter(v => v !== null)
              const trend = validVals.length > 1
                ? validVals[validVals.length - 1] > validVals[0] ? '↑' : validVals[validVals.length - 1] < validVals[0] ? '↓' : '→'
                : '—'
              const trendColor = trend === '↑' ? '#68D391' : trend === '↓' ? '#FC8181' : '#D4956A'

              return (
                <tr key={m.name} style={{ background: mi % 2 === 0 ? 'white' : 'var(--cream)', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                    {m.name}{m.unit ? ` (${m.unit})` : ''}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--slate-light)', fontSize: '0.75rem' }}>
                    {m.low !== undefined && m.high !== undefined ? `${m.low}–${m.high}` : '—'}
                  </td>
                  {m.values.map((v, i) => {
                    const isLow = m.low !== undefined && v !== null && v < m.low
                    const isHigh = m.high !== undefined && v !== null && v > m.high
                    return (
                      <td key={i} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: v !== null ? 600 : 400, color: isLow ? '#E53E3E' : isHigh ? '#DD6B20' : v !== null ? 'var(--navy)' : 'var(--slate-light)' }}>
                        {v !== null ? `${v}${m.unit ? ' ' + m.unit : ''}` : '—'}
                        {isLow && <span style={{ fontSize: '0.65rem', marginLeft: 2, color: '#E53E3E' }}>L</span>}
                        {isHigh && <span style={{ fontSize: '0.65rem', marginLeft: 2, color: '#DD6B20' }}>H</span>}
                      </td>
                    )
                  })}
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: trendColor }}>{trend}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {trendData.summary && (
        <div style={{ marginTop: 20, padding: '14px 18px', background: 'var(--sage-light)', border: '1px solid var(--sage)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', color: 'var(--slate)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          <div style={{ fontWeight: 600, color: 'var(--sage-dark)', marginBottom: 6 }}>📋 AI Summary & Observations</div>
          {trendData.summary}
        </div>
      )}
    </div>
  )
}

export default function Vault({ patient }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('all')
  const [documents, setDocuments] = useState([])
  const [labResults, setLabResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showLabModal, setShowLabModal] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [trendData, setTrendData] = useState(null)
  const [trendError, setTrendError] = useState('')
  const [trendStatus, setTrendStatus] = useState('')
  const [uploadForm, setUploadForm] = useState({ name: '', category: 'medical', notes: '' })
  const [uploadMsg, setUploadMsg] = useState('')
  const [labFile, setLabFile] = useState(null)
  const [labLabel, setLabLabel] = useState('')
  const [labDate, setLabDate] = useState('')
  const [labLoading, setLabLoading] = useState(false)
  const [labMsg, setLabMsg] = useState('')
  const [singleDocAnalysis, setSingleDocAnalysis] = useState({})
  const [singleDocLoading, setSingleDocLoading] = useState({})
  const fileRef = useRef(null)
  const labFileRef = useRef(null)

  useEffect(() => {
    if (patient?.id) { fetchDocuments(); fetchLabResults() }
  }, [patient])

  const fetchDocuments = async () => {
    setLoading(true)
    const { data } = await supabase.from('vault_documents').select('*, profiles(full_name)').eq('patient_id', patient.id).order('created_at', { ascending: false })
    setDocuments(data || [])
    setLoading(false)
  }

  const fetchLabResults = async () => {
    const { data } = await supabase.from('lab_results').select('*').eq('patient_id', patient.id).order('test_date', { ascending: true })
    setLabResults(data || [])
  }

  const uploadDocument = async () => {
    const file = fileRef.current?.files[0]
    if (!file || !uploadForm.name) return
    setUploading(true); setUploadMsg('')
    try {
      const ext = file.name.split('.').pop()
      const path = `${patient.id}/${Date.now()}.${ext}`
      const { error: storageError } = await supabase.storage.from('vault').upload(path, file)
      if (storageError) throw storageError
      const { data: { publicUrl } } = supabase.storage.from('vault').getPublicUrl(path)
      await supabase.from('vault_documents').insert({ patient_id: patient.id, uploaded_by: user.id, name: uploadForm.name, category: uploadForm.category, notes: uploadForm.notes, file_url: publicUrl, file_name: file.name, file_type: file.type, file_size: file.size, storage_path: path })
      setUploadMsg('Document uploaded!')
      setUploadForm({ name: '', category: 'medical', notes: '' })
      if (fileRef.current) fileRef.current.value = ''
      await fetchDocuments()
      setTimeout(() => { setShowUploadModal(false); setUploadMsg('') }, 1000)
    } catch (err) { setUploadMsg('Upload failed: ' + err.message) }
    finally { setUploading(false) }
  }

  const uploadLabResult = async () => {
    if (!labFile || !labLabel) return
    setLabLoading(true); setLabMsg('')
    try {
      const files = Array.isArray(labFile) ? labFile : [labFile]
      const uploadedUrls = [], uploadedNames = []
      for (const f of files) {
        const ext = f.name.split('.').pop()
        const path = `${patient.id}/labs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        await supabase.storage.from('vault').upload(path, f)
        const { data: { publicUrl } } = supabase.storage.from('vault').getPublicUrl(path)
        uploadedUrls.push(publicUrl); uploadedNames.push(f.name)
      }
      await supabase.from('lab_results').insert({ patient_id: patient.id, uploaded_by: user.id, test_name: labLabel, test_date: labDate || new Date().toISOString().split('T')[0], results: 'Uploaded — click AI Analysis to analyze', file_url: uploadedUrls[0], file_urls: uploadedUrls, file_name: uploadedNames.join(', '), file_type: files[0].type })
      setLabMsg(`${files.length} file${files.length > 1 ? 's' : ''} uploaded!`)
      setLabLabel(''); setLabDate(''); setLabFile(null)
      if (labFileRef.current) labFileRef.current.value = ''
      await fetchLabResults()
      setTimeout(() => { setShowLabModal(false); setLabMsg('') }, 1000)
    } catch (err) { setLabMsg('Upload failed: ' + err.message) }
    finally { setLabLoading(false) }
  }

  const analyzeSingleDoc = async (lab) => {
    setSingleDocLoading(prev => ({ ...prev, [lab.id]: true }))
    setSingleDocAnalysis(prev => ({ ...prev, [lab.id]: '' }))
    try {
      const urls = lab.file_urls || (lab.file_url ? [lab.file_url] : [])
      let messageContent = []
      for (const url of urls) {
        const res = await fetch(url)
        const blob = await res.blob()
        const base64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = reject; r.readAsDataURL(blob) })
        const mimeType = blob.type || 'image/jpeg'
        if (mimeType === 'application/pdf') messageContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
        else messageContent.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } })
      }
      messageContent.push({ type: 'text', text: `Analyze these lab results for ${patient.name} (${urls.length} file(s)). Extract all test values, identify normal vs abnormal, explain each result in plain language, highlight anything to discuss with the doctor. Patient conditions: ${patient.primary_diagnosis || 'not specified'}, ${patient.other_conditions || 'none'}.` })
      const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system: 'You are a compassionate medical assistant. Be warm, clear, avoid medical jargon. Always remind the family to discuss with their doctor. Format: What This Report Shows, Values to Watch, Questions to Ask Your Doctor.', messages: [{ role: 'user', content: messageContent }] }) })
      const data = await response.json()
      setSingleDocAnalysis(prev => ({ ...prev, [lab.id]: data.content?.[0]?.text || 'Unable to analyze.' }))
    } catch { setSingleDocAnalysis(prev => ({ ...prev, [lab.id]: 'Unable to connect. Please try again.' })) }
    finally { setSingleDocLoading(prev => ({ ...prev, [lab.id]: false })) }
  }

  const analyzeLabTrends = async () => {
    if (labResults.length < 2) return
    setAiLoading(true); setShowAIModal(true); setTrendData(null); setTrendError(''); setTrendStatus('')

    try {
      // Step 1: Read each lab document and extract structured data
      const extractedResults = []
      for (let i = 0; i < labResults.length; i++) {
        const lab = labResults[i]
        setTrendStatus(`Reading document ${i + 1} of ${labResults.length}: ${lab.test_name}...`)
        const urls = lab.file_urls || (lab.file_url ? [lab.file_url] : [])
        let messageContent = []

        for (const url of urls) {
          try {
            const res = await fetch(url)
            const blob = await res.blob()
            const base64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = reject; r.readAsDataURL(blob) })
            const mimeType = blob.type || 'image/jpeg'
            if (mimeType === 'application/pdf') messageContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
            else messageContent.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } })
          } catch {}
        }

        if (messageContent.length === 0) {
          extractedResults.push({ date: lab.test_date, label: lab.test_name, values: {} })
          continue
        }

        messageContent.push({ type: 'text', text: `Extract ALL numeric lab test values from this document. Respond ONLY with a JSON object — no markdown, no explanation, no backticks. Format: {"testName": {"value": number, "unit": "string", "low": number_or_null, "high": number_or_null}, ...}. Example: {"Hemoglobin": {"value": 11.2, "unit": "g/dL", "low": 12.0, "high": 16.0}, "WBC": {"value": 6.4, "unit": "K/uL", "low": 4.5, "high": 11.0}}` })

        const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: 'You are a medical data extractor. Return ONLY valid JSON with no markdown, no backticks, no extra text.', messages: [{ role: 'user', content: messageContent }] }) })
        const data = await response.json()
        let parsed = {}
        try { parsed = JSON.parse(data.content?.[0]?.text || '{}') } catch {}
        extractedResults.push({ date: lab.test_date, label: lab.test_name, values: parsed })
      }

      // Step 2: Build unified trend dataset
      setTrendStatus('Building trend chart...')
      const allMetrics = {}
      extractedResults.forEach(r => {
        Object.entries(r.values).forEach(([name, info]) => {
          if (!allMetrics[name]) allMetrics[name] = { name, unit: info.unit || '', low: info.low, high: info.high, values: new Array(extractedResults.length).fill(null) }
          const idx = extractedResults.indexOf(r)
          allMetrics[name].values[idx] = info.value
        })
      })

      const dates = extractedResults.map(r => {
        const d = new Date(r.date)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
      })

      const metrics = Object.values(allMetrics).filter(m => m.values.some(v => v !== null))

      // Step 3: Get AI summary
      setTrendStatus('Generating summary...')
      const summaryPrompt = `Based on these lab results for ${patient.name} across ${dates.length} visits (${dates.join(', ')}), provide a brief compassionate summary of overall trends, anything concerning, and 3-5 questions to ask the doctor. Keep it under 200 words.\n\nMetrics tracked: ${metrics.map(m => `${m.name}: ${m.values.map((v, i) => v !== null ? `${dates[i]}=${v}${m.unit}` : null).filter(Boolean).join(', ')}`).join('\n')}`

      const summaryRes = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 400, messages: [{ role: 'user', content: summaryPrompt }] }) })
      const summaryData = await summaryRes.json()
      const summary = summaryData.content?.[0]?.text || ''

      setTrendData({ dates, metrics, summary })
      setTrendStatus('')
    } catch (err) {
      setTrendError('Failed to analyze trends. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  const deleteDocument = async (doc) => {
    if (!confirm(`Delete "${doc.name}"?`)) return
    await supabase.storage.from('vault').remove([doc.storage_path])
    await supabase.from('vault_documents').delete().eq('id', doc.id)
    await fetchDocuments()
  }

  const deleteLabResult = async (lab) => {
    if (!confirm(`Delete "${lab.test_name}"?`)) return
    await supabase.from('lab_results').delete().eq('id', lab.id)
    await fetchLabResults()
  }

  const formatSize = (bytes) => { if (!bytes) return ''; if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / 1048576).toFixed(1) + ' MB' }
  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const filteredDocs = activeTab === 'all' ? documents : activeTab === 'labs' ? [] : documents.filter(d => d.category === activeTab)
  const getCategoryInfo = (id) => DOC_CATEGORIES.find(c => c.id === id) || { emoji: '📄', label: id }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1 className="page-title">The Vault</h1><p className="page-subtitle">Secure documents for {patient?.name}'s care</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowLabModal(true)}>🔬 Upload Lab Results</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>+ Upload Document</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('all')} style={{ padding: '8px 16px', borderRadius: 20, border: '1.5px solid', borderColor: activeTab === 'all' ? 'var(--sage)' : 'var(--border)', background: activeTab === 'all' ? 'var(--sage-light)' : 'white', color: activeTab === 'all' ? 'var(--sage-dark)' : 'var(--slate)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          All Documents ({documents.length})
        </button>
        {DOC_CATEGORIES.map(cat => {
          const count = cat.id === 'lab_results' ? labResults.length : documents.filter(d => d.category === cat.id).length
          const tabId = cat.id === 'lab_results' ? 'labs' : cat.id
          return <button key={cat.id} onClick={() => setActiveTab(tabId)} style={{ padding: '8px 16px', borderRadius: 20, border: '1.5px solid', borderColor: activeTab === tabId ? 'var(--sage)' : 'var(--border)', background: activeTab === tabId ? 'var(--sage-light)' : 'white', color: activeTab === tabId ? 'var(--sage-dark)' : 'var(--slate)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{cat.emoji} {cat.label} {count > 0 ? `(${count})` : ''}</button>
        })}
      </div>

      {activeTab === 'labs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--navy)' }}>Lab Results & Imaging ({labResults.length})</h2>
            {labResults.length > 1 && <button className="btn btn-primary btn-sm" onClick={analyzeLabTrends}>📊 Trend Chart</button>}
          </div>

          <div style={{ background: 'var(--sage-light)', border: '1px solid var(--sage)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, fontSize: '0.85rem', color: 'var(--sage-dark)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>💡</span>
            <div><strong>Just upload your files.</strong> Select one or multiple screenshots/PDFs — AI reads and analyzes them. For trend charts, upload at least 2 lab results from different dates.</div>
          </div>

          {labResults.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>🔬</p>
              <h3>No lab results yet</h3>
              <p style={{ marginBottom: 16 }}>Upload screenshots or PDFs of lab reports. AI reads and analyzes them — no typing required.</p>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowLabModal(true)}>Upload First Lab Result</button>
            </div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {labResults.map(lab => (
                <div key={lab.id} className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.4rem' }}>🔬</span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{lab.test_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--slate-light)', marginTop: 2 }}>{formatDate(lab.test_date)}{lab.file_name && ` · ${lab.file_name}`}{lab.file_urls?.length > 1 && ` (${lab.file_urls.length} files)`}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                      {lab.file_url && <a href={lab.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>View</a>}
                      <button className="btn btn-primary btn-sm" onClick={() => analyzeSingleDoc(lab)} disabled={singleDocLoading[lab.id]}>{singleDocLoading[lab.id] ? 'Analyzing...' : '✨ AI Analysis'}</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteLabResult(lab)}>×</button>
                    </div>
                  </div>
                  {singleDocLoading[lab.id] && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px', background: 'var(--cream)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.875rem', color: 'var(--slate-light)' }}>Reading your lab document and analyzing results...</span>
                    </div>
                  )}
                  {singleDocAnalysis[lab.id] && !singleDocLoading[lab.id] && (
                    <div style={{ background: 'var(--sage-light)', border: '1px solid var(--sage)', borderRadius: 'var(--radius-sm)', padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--sage-dark)', marginBottom: 10, fontSize: '0.875rem' }}>✨ AI Analysis</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--slate)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{singleDocAnalysis[lab.id]}</div>
                      <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--slate-light)', fontStyle: 'italic' }}>⚠️ For informational purposes only. Always discuss results with your doctor.</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab !== 'labs' && (
        <div>
          {loading ? <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          : filteredDocs.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</p>
              <h3>No documents yet</h3>
              <p style={{ marginBottom: 16 }}>{activeTab === 'all' ? 'Upload important documents to keep everything in one secure place.' : `No ${getCategoryInfo(activeTab).label.toLowerCase()} uploaded yet.`}</p>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowUploadModal(true)}>Upload First Document</button>
            </div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {filteredDocs.map(doc => {
                const cat = getCategoryInfo(doc.category)
                return (
                  <div key={doc.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--sage-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>{cat.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem', marginBottom: 2 }}>{doc.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)' }}>{cat.label} · {formatSize(doc.file_size)}</div>
                      </div>
                    </div>
                    {doc.notes && <div style={{ fontSize: '0.82rem', color: 'var(--slate)', lineHeight: 1.5 }}>{doc.notes}</div>}
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)' }}>Uploaded {formatDate(doc.created_at)} by {doc.profiles?.full_name || 'Admin'}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>View</a>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteDocument(doc)} style={{ flex: 1 }}>Delete</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Upload Lab Modal */}
      {showLabModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={e => { if (e.target === e.currentTarget) setShowLabModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Upload Lab Results</h2>
              <button onClick={() => setShowLabModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            <div style={{ background: 'var(--sage-light)', border: '1px solid var(--sage)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 20, fontSize: '0.82rem', color: 'var(--sage-dark)' }}>
              📄 Select one or multiple screenshots/PDFs — AI will read them all together. No typing required.
            </div>
            {labMsg && <div className={labMsg.includes('failed') ? 'error-message' : 'success-message'}>{labMsg}</div>}
            <div className="form-group">
              <label>Label *</label>
              <input value={labLabel} onChange={e => setLabLabel(e.target.value)} placeholder="e.g. CBC Bloodwork March 2026" />
            </div>
            <div className="form-group">
              <label>Test date</label>
              <input type="date" value={labDate} onChange={e => setLabDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Upload files * (select multiple if needed)</label>
              <input type="file" ref={labFileRef} accept=".pdf,.jpg,.jpeg,.png" multiple style={{ padding: '8px 0' }} onChange={e => setLabFile(Array.from(e.target.files))} />
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)', marginTop: 4 }}>Hold Ctrl (or Cmd on Mac) to select multiple screenshots</div>
              {labFile?.length > 0 && <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--sage-dark)', background: 'var(--sage-light)', padding: '8px 12px', borderRadius: 6 }}>✓ {labFile.length} file{labFile.length > 1 ? 's' : ''} selected: {labFile.map(f => f.name).join(', ')}</div>}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowLabModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={uploadLabResult} disabled={labLoading || !labLabel || !labFile?.length} style={{ flex: 1 }}>{labLoading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={e => { if (e.target === e.currentTarget) setShowUploadModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Upload Document</h2>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            {uploadMsg && <div className={uploadMsg.includes('failed') ? 'error-message' : 'success-message'}>{uploadMsg}</div>}
            <div className="form-group"><label>Document name *</label><input value={uploadForm.name} onChange={e => setUploadForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Mom's DNR — signed 2024" /></div>
            <div className="form-group"><label>Category</label><select value={uploadForm.category} onChange={e => setUploadForm(p => ({ ...p, category: e.target.value }))}>{DOC_CATEGORIES.filter(c => c.id !== 'lab_results').map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}</select></div>
            <div className="form-group"><label>Notes (optional)</label><textarea value={uploadForm.notes} onChange={e => setUploadForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any important details about this document..." rows={2} /></div>
            <div className="form-group"><label>File *</label><input type="file" ref={fileRef} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ padding: '8px 0' }} /><div style={{ fontSize: '0.75rem', color: 'var(--slate-light)', marginTop: 4 }}>PDF, images, or Word documents</div></div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={uploadDocument} disabled={uploading || !uploadForm.name} style={{ flex: 1 }}>{uploading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Trend Chart Modal */}
      {showAIModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={e => { if (e.target === e.currentTarget) setShowAIModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>📊 Lab Trend Analysis</h2>
              <button onClick={() => setShowAIModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>

            {aiLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <p style={{ color: 'var(--slate)', fontWeight: 500, marginBottom: 6 }}>{trendStatus || 'Analyzing documents...'}</p>
                <p style={{ color: 'var(--slate-light)', fontSize: '0.82rem' }}>Reading each lab document and extracting values. This may take a moment.</p>
              </div>
            )}

            {trendError && !aiLoading && (
              <div className="error-message">{trendError}</div>
            )}

            {trendData && !aiLoading && (
              <div>
                <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', marginBottom: 20, fontSize: '0.78rem', color: 'var(--slate)' }}>
                  ⚠️ For informational purposes only. Always discuss results with your doctor. L = below normal, H = above normal.
                </div>
                <TrendChart trendData={trendData} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
