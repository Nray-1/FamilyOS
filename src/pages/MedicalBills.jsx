import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function MedicalBills({ patient }) {
  const { user } = useAuth()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [billLabel, setBillLabel] = useState('')
  const [billDate, setBillDate] = useState('')
  const [billFile, setBillFile] = useState(null)
  const [analysis, setAnalysis] = useState({})
  const [analyzing, setAnalyzing] = useState({})
  const fileRef = useRef(null)

  useEffect(() => { if (patient?.id) fetchBills() }, [patient])

  const fetchBills = async () => {
    setLoading(true)
    const { data } = await supabase.from('medical_bills').select('*').eq('patient_id', patient.id).order('bill_date', { ascending: false })
    setBills(data || [])
    setLoading(false)
  }

  const uploadBill = async () => {
    if (!billFile || !billLabel) return
    setUploading(true); setUploadMsg('')
    try {
      const files = Array.isArray(billFile) ? billFile : [billFile]
      const uploadedUrls = [], uploadedNames = []
      for (const f of files) {
        const ext = f.name.split('.').pop()
        const path = `${patient.id}/bills/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        await supabase.storage.from('vault').upload(path, f)
        const { data: { publicUrl } } = supabase.storage.from('vault').getPublicUrl(path)
        uploadedUrls.push(publicUrl); uploadedNames.push(f.name)
      }
      await supabase.from('medical_bills').insert({
        patient_id: patient.id, uploaded_by: user.id,
        label: billLabel, bill_date: billDate || new Date().toISOString().split('T')[0],
        file_url: uploadedUrls[0], file_urls: uploadedUrls,
        file_name: uploadedNames.join(', '), file_type: files[0].type,
      })
      setUploadMsg(`${files.length} file${files.length > 1 ? 's' : ''} uploaded!`)
      setBillLabel(''); setBillDate(''); setBillFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await fetchBills()
      setTimeout(() => { setShowUploadModal(false); setUploadMsg('') }, 1000)
    } catch (err) { setUploadMsg('Upload failed: ' + err.message) }
    finally { setUploading(false) }
  }

  const analyzeBill = async (bill) => {
    setAnalyzing(prev => ({ ...prev, [bill.id]: true }))
    setAnalysis(prev => ({ ...prev, [bill.id]: '' }))
    try {
      const urls = bill.file_urls || (bill.file_url ? [bill.file_url] : [])
      let messageContent = []
      for (const url of urls) {
        const res = await fetch(url)
        const blob = await res.blob()
        const base64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = reject; r.readAsDataURL(blob) })
        const mimeType = blob.type || 'image/jpeg'
        if (mimeType === 'application/pdf') messageContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
        else messageContent.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } })
      }
      messageContent.push({
        type: 'text',
        text: `You are a medical billing expert and patient advocate. Analyze this medical bill for ${patient.name} and help find every possible way to reduce the cost.

Please provide:

1. **Bill Summary** — What is being charged, total amount, provider, date of service
2. **Line Item Review** — Flag any charges that look incorrect, duplicated, or unusually high
3. **Cost Reduction Strategies** — Specific, actionable steps such as:
   - Negotiation tips (many hospitals will reduce bills 20-50% if you ask)
   - Financial assistance programs this provider may offer
   - Whether to request an itemized bill if not already provided
   - Common billing errors to dispute (upcoding, unbundling, duplicate charges)
   - Payment plan options
   - Whether a medical billing advocate would help
4. **Script to Call the Billing Department** — Give them exact words to say when calling
5. **Questions to Ask** — Key questions to ask the billing department

Patient conditions: ${patient.primary_diagnosis || 'not specified'}.
Be specific, practical, and compassionate. This family is under financial stress.`
      })

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: 'You are a compassionate medical billing expert helping families reduce their medical costs. Be specific, actionable, and warm. Format responses with clear headers and bullet points.', messages: [{ role: 'user', content: messageContent }] })
      })
      const data = await response.json()
      setAnalysis(prev => ({ ...prev, [bill.id]: data.content?.[0]?.text || 'Unable to analyze.' }))
    } catch { setAnalysis(prev => ({ ...prev, [bill.id]: 'Unable to connect. Please try again.' })) }
    finally { setAnalyzing(prev => ({ ...prev, [bill.id]: false })) }
  }

  const deleteBill = async (bill) => {
    if (!confirm(`Delete "${bill.label}"?`)) return
    await supabase.from('medical_bills').delete().eq('id', bill.id)
    await fetchBills()
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Medical Bills</h1>
          <p className="page-subtitle">Upload bills and let AI find ways to reduce costs</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>+ Upload Bill</button>
      </div>

      <div style={{ background: 'var(--sage-light)', border: '1px solid var(--sage)', borderRadius: 'var(--radius-sm)', padding: '14px 18px', marginBottom: 24, fontSize: '0.875rem', color: 'var(--sage-dark)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>💡</span>
        <div>
          <strong>How this works:</strong> Upload any medical bill (photo or PDF). AI reads the bill, flags overcharges, identifies billing errors, and gives you a step-by-step plan to reduce the cost — including the exact words to say when you call the billing department.
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : bills.length === 0 ? (
        <div className="card"><div className="empty-state">
          <p style={{ fontSize: '3rem', marginBottom: 12 }}>🧾</p>
          <h3>No bills uploaded yet</h3>
          <p style={{ marginBottom: 16 }}>Upload a medical bill and AI will find every possible way to reduce what you owe.</p>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowUploadModal(true)}>Upload First Bill</button>
        </div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {bills.map(bill => (
            <div key={bill.id} className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: analysis[bill.id] ? 16 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🧾</div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{bill.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--slate-light)', marginTop: 2 }}>
                      {formatDate(bill.bill_date)}{bill.file_name && ` · ${bill.file_name}`}
                      {bill.file_urls?.length > 1 && ` (${bill.file_urls.length} files)`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                  {bill.file_url && <a href={bill.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>View</a>}
                  <button className="btn btn-primary btn-sm" onClick={() => analyzeBill(bill)} disabled={analyzing[bill.id]}>
                    {analyzing[bill.id] ? 'Analyzing...' : '✨ Find Savings'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteBill(bill)}>×</button>
                </div>
              </div>

              {analyzing[bill.id] && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px', background: 'var(--cream)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--slate-light)' }}>Reading your bill and finding every possible way to reduce costs...</span>
                </div>
              )}

              {analysis[bill.id] && !analyzing[bill.id] && (
                <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '20px 24px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 14, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>✨</span> AI Cost Reduction Analysis
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--slate)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                    {analysis[bill.id]}
                  </div>
                  <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--slate)' }}>
                    ⚠️ This is AI-generated guidance. Always verify information with the billing department directly.
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={e => { if (e.target === e.currentTarget) setShowUploadModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Upload Medical Bill</h2>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            <div style={{ background: 'var(--sage-light)', border: '1px solid var(--sage)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 20, fontSize: '0.82rem', color: 'var(--sage-dark)' }}>
              📄 Upload a photo or PDF of any medical bill. You can select multiple files if the bill spans multiple pages.
            </div>
            {uploadMsg && <div className={uploadMsg.includes('failed') ? 'error-message' : 'success-message'}>{uploadMsg}</div>}
            <div className="form-group">
              <label>Bill description *</label>
              <input value={billLabel} onChange={e => setBillLabel(e.target.value)} placeholder="e.g. Baptist Hospital ER Visit, Oncology Follow-up" />
            </div>
            <div className="form-group">
              <label>Bill date</label>
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Upload file(s) *</label>
              <input type="file" ref={fileRef} accept=".pdf,.jpg,.jpeg,.png" multiple style={{ padding: '8px 0' }} onChange={e => setBillFile(Array.from(e.target.files))} />
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)', marginTop: 4 }}>Hold Ctrl (or Cmd on Mac) to select multiple pages</div>
              {billFile?.length > 0 && <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--sage-dark)', background: 'var(--sage-light)', padding: '8px 12px', borderRadius: 6 }}>✓ {billFile.length} file{billFile.length > 1 ? 's' : ''} selected</div>}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={uploadBill} disabled={uploading || !billLabel || !billFile?.length} style={{ flex: 1 }}>{uploading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
