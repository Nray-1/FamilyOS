import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const DOC_CATEGORIES = [
  { id: 'legal',       label: 'Legal Documents',     emoji: '📜', description: 'DNR, Will, Power of Attorney, Advance Directive' },
  { id: 'insurance',   label: 'Insurance',           emoji: '🛡️', description: 'Insurance cards, policy details, EOBs' },
  { id: 'medical',     label: 'Medical Records',     emoji: '🏥', description: 'Doctor notes, discharge summaries, referrals' },
  { id: 'medication',  label: 'Medications',         emoji: '💊', description: 'Medication lists, prescriptions, schedules' },
  { id: 'contacts',    label: 'Emergency Contacts',  emoji: '📞', description: 'Doctors, specialists, emergency contacts' },
  { id: 'lab_results', label: 'Lab Results',         emoji: '🔬', description: 'Bloodwork, MRI, pathology, imaging reports' },
]

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
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [uploadForm, setUploadForm] = useState({ name: '', category: 'medical', notes: '' })
  const [uploadMsg, setUploadMsg] = useState('')

  // Lab upload state — just file + label + date
  const [labFile, setLabFile] = useState(null)
  const [labLabel, setLabLabel] = useState('')
  const [labDate, setLabDate] = useState('')
  const [labLoading, setLabLoading] = useState(false)
  const [labMsg, setLabMsg] = useState('')
  const [analyzingDoc, setAnalyzingDoc] = useState(null)
  const [singleDocAnalysis, setSingleDocAnalysis] = useState({})
  const [singleDocLoading, setSingleDocLoading] = useState({})

  const fileRef = useRef(null)
  const labFileRef = useRef(null)

  useEffect(() => {
    if (patient?.id) {
      fetchDocuments()
      fetchLabResults()
    }
  }, [patient])

  const fetchDocuments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('vault_documents')
      .select('*, profiles(full_name)')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
    setDocuments(data || [])
    setLoading(false)
  }

  const fetchLabResults = async () => {
    const { data } = await supabase
      .from('lab_results')
      .select('*')
      .eq('patient_id', patient.id)
      .order('test_date', { ascending: false })
    setLabResults(data || [])
  }

  const uploadDocument = async () => {
    const file = fileRef.current?.files[0]
    if (!file || !uploadForm.name) return
    setUploading(true)
    setUploadMsg('')
    try {
      const ext = file.name.split('.').pop()
      const path = `${patient.id}/${Date.now()}.${ext}`
      const { error: storageError } = await supabase.storage.from('vault').upload(path, file)
      if (storageError) throw storageError
      const { data: { publicUrl } } = supabase.storage.from('vault').getPublicUrl(path)
      await supabase.from('vault_documents').insert({
        patient_id: patient.id, uploaded_by: user.id,
        name: uploadForm.name, category: uploadForm.category,
        notes: uploadForm.notes, file_url: publicUrl,
        file_name: file.name, file_type: file.type,
        file_size: file.size, storage_path: path,
      })
      setUploadMsg('Document uploaded!')
      setUploadForm({ name: '', category: 'medical', notes: '' })
      if (fileRef.current) fileRef.current.value = ''
      await fetchDocuments()
      setTimeout(() => { setShowUploadModal(false); setUploadMsg('') }, 1000)
    } catch (err) {
      setUploadMsg('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // Convert file to base64
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const uploadLabResult = async () => {
    if (!labFile || !labLabel) return
    setLabLoading(true)
    setLabMsg('')
    try {
      // Upload file to storage
      const ext = labFile.name.split('.').pop()
      const path = `${patient.id}/labs/${Date.now()}.${ext}`
      await supabase.storage.from('vault').upload(path, labFile)
      const { data: { publicUrl } } = supabase.storage.from('vault').getPublicUrl(path)

      // Save to DB with minimal info — AI will read the file
      await supabase.from('lab_results').insert({
        patient_id: patient.id,
        uploaded_by: user.id,
        test_name: labLabel,
        test_date: labDate || new Date().toISOString().split('T')[0],
        results: 'Uploaded document — click "AI Analysis" to analyze',
        file_url: publicUrl,
        file_name: labFile.name,
        file_type: labFile.type,
      })

      setLabMsg('Lab document uploaded!')
      setLabLabel('')
      setLabDate('')
      setLabFile(null)
      if (labFileRef.current) labFileRef.current.value = ''
      await fetchLabResults()
      setTimeout(() => { setShowLabModal(false); setLabMsg('') }, 1000)
    } catch (err) {
      setLabMsg('Upload failed: ' + err.message)
    } finally {
      setLabLoading(false)
    }
  }

  // Analyze a single lab document by reading the file directly
  const analyzeSingleDoc = async (lab) => {
    setSingleDocLoading(prev => ({ ...prev, [lab.id]: true }))
    setSingleDocAnalysis(prev => ({ ...prev, [lab.id]: '' }))
    try {
      const isImage = lab.file_type?.startsWith('image/')
      const isPDF = lab.file_type === 'application/pdf'

      let messageContent = []

      if (lab.file_url && (isImage || isPDF)) {
        // Fetch the file and convert to base64
        const res = await fetch(lab.file_url)
        const blob = await res.blob()
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })

        if (isPDF) {
          messageContent = [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: `Please analyze this lab report for ${patient.name}. Extract all test values, identify what's normal vs abnormal, explain what each result means in plain language, and highlight anything that should be discussed with the doctor. The patient's conditions are: ${patient.primary_diagnosis || 'not specified'}, ${patient.other_conditions || 'none'}.` }
          ]
        } else {
          messageContent = [
            { type: 'image', source: { type: 'base64', media_type: lab.file_type, data: base64 } },
            { type: 'text', text: `Please analyze this lab report image for ${patient.name}. Extract all test values, identify what's normal vs abnormal, explain what each result means in plain language, and highlight anything that should be discussed with the doctor. The patient's conditions are: ${patient.primary_diagnosis || 'not specified'}, ${patient.other_conditions || 'none'}.` }
          ]
        }
      } else {
        messageContent = [{ type: 'text', text: `Analyze these lab results for ${patient.name}: ${lab.results}` }]
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: `You are a compassionate medical assistant helping a family caregiver understand lab results. Be warm, clear, and avoid overwhelming medical jargon. Always remind the family to discuss findings with their doctor. Format with clear sections: What This Report Shows, Values to Watch, Questions to Ask Your Doctor.`,
          messages: [{ role: 'user', content: messageContent }]
        })
      })
      const data = await response.json()
      setSingleDocAnalysis(prev => ({ ...prev, [lab.id]: data.content?.[0]?.text || 'Unable to analyze.' }))
    } catch (err) {
      setSingleDocAnalysis(prev => ({ ...prev, [lab.id]: 'Unable to connect. Please try again.' }))
    } finally {
      setSingleDocLoading(prev => ({ ...prev, [lab.id]: false }))
    }
  }

  // Analyze all lab results together for trends
  const analyzeLabTrends = async () => {
    if (labResults.length === 0) return
    setAiLoading(true)
    setShowAIModal(true)
    setAiAnalysis('')
    try {
      // For trend analysis, we send all file URLs + context
      const labSummary = labResults.map(r =>
        `Document: ${r.test_name} | Date: ${r.test_date} | File: ${r.file_url || 'no file'}`
      ).join('\n')

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: `You are a compassionate medical assistant helping a family caregiver understand their loved one's lab results over time. Patient: ${patient.name}, Conditions: ${patient.primary_diagnosis || 'not specified'}, ${patient.other_conditions || ''}. Analyze the lab results, identify trends over time, flag anything concerning, and suggest questions to ask the doctor. Be warm and avoid medical jargon. Format: Summary, Trends to Watch, Questions to Ask Your Doctor.`,
          messages: [{ role: 'user', content: `Here are ${patient.name}'s lab documents over time:\n\n${labSummary}\n\nBased on the document names, dates, and context, provide trend analysis and guidance. Note: encourage the family to use the individual "AI Analysis" button on each document for detailed per-document analysis.` }]
        })
      })
      const data = await response.json()
      setAiAnalysis(data.content?.[0]?.text || 'Unable to analyze results.')
    } catch {
      setAiAnalysis('Unable to connect to AI analysis. Please try again.')
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

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const filteredDocs = activeTab === 'all' ? documents : activeTab === 'labs' ? [] : documents.filter(d => d.category === activeTab)
  const getCategoryInfo = (id) => DOC_CATEGORIES.find(c => c.id === id) || { emoji: '📄', label: id }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">The Vault</h1>
          <p className="page-subtitle">Secure documents for {patient?.name}'s care</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowLabModal(true)}>🔬 Upload Lab Results</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>+ Upload Document</button>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('all')} style={{ padding: '8px 16px', borderRadius: 20, border: '1.5px solid', borderColor: activeTab === 'all' ? 'var(--sage)' : 'var(--border)', background: activeTab === 'all' ? 'var(--sage-light)' : 'white', color: activeTab === 'all' ? 'var(--sage-dark)' : 'var(--slate)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          All Documents ({documents.length})
        </button>
        {DOC_CATEGORIES.map(cat => {
          const count = cat.id === 'lab_results' ? labResults.length : documents.filter(d => d.category === cat.id).length
          const tabId = cat.id === 'lab_results' ? 'labs' : cat.id
          return (
            <button key={cat.id} onClick={() => setActiveTab(tabId)} style={{ padding: '8px 16px', borderRadius: 20, border: '1.5px solid', borderColor: activeTab === tabId ? 'var(--sage)' : 'var(--border)', background: activeTab === tabId ? 'var(--sage-light)' : 'white', color: activeTab === tabId ? 'var(--sage-dark)' : 'var(--slate)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              {cat.emoji} {cat.label} {count > 0 ? `(${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* Lab Results Section */}
      {activeTab === 'labs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--navy)' }}>
              Lab Results & Imaging ({labResults.length})
            </h2>
            {labResults.length > 1 && (
              <button className="btn btn-primary btn-sm" onClick={analyzeLabTrends}>✨ Trend Analysis</button>
            )}
          </div>

          {/* How it works banner */}
          <div style={{ background: 'var(--sage-light)', border: '1px solid var(--sage)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, fontSize: '0.85rem', color: 'var(--sage-dark)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>💡</span>
            <div>
              <strong>Just upload your document.</strong> Upload any PDF or image of lab results and AI will read and analyze it for you — no manual data entry needed.
            </div>
          </div>

          {labResults.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>🔬</p>
              <h3>No lab results yet</h3>
              <p style={{ marginBottom: 16 }}>Upload a PDF or photo of any lab report, bloodwork, or imaging result. AI will read and analyze it.</p>
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
                        <div style={{ fontSize: '0.78rem', color: 'var(--slate-light)', marginTop: 2 }}>
                          {formatDate(lab.test_date)}{lab.file_name ? ` · ${lab.file_name}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                      {lab.file_url && (
                        <a href={lab.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>View File</a>
                      )}
                      <button className="btn btn-primary btn-sm" onClick={() => analyzeSingleDoc(lab)} disabled={singleDocLoading[lab.id]}>
                        {singleDocLoading[lab.id] ? 'Analyzing...' : '✨ AI Analysis'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteLabResult(lab)}>×</button>
                    </div>
                  </div>

                  {/* AI Analysis result */}
                  {singleDocLoading[lab.id] && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px', background: 'var(--cream)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.875rem', color: 'var(--slate-light)' }}>Reading your lab document and analyzing results...</span>
                    </div>
                  )}

                  {singleDocAnalysis[lab.id] && !singleDocLoading[lab.id] && (
                    <div style={{ background: 'var(--sage-light)', border: '1px solid var(--sage)', borderRadius: 'var(--radius-sm)', padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--sage-dark)', marginBottom: 10, fontSize: '0.875rem' }}>✨ AI Analysis</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--slate)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                        {singleDocAnalysis[lab.id]}
                      </div>
                      <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--slate-light)', fontStyle: 'italic' }}>
                        ⚠️ For informational purposes only. Always discuss results with your doctor.
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Documents Section */}
      {activeTab !== 'labs' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : filteredDocs.length === 0 ? (
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

      {/* Upload Lab Result Modal — simplified */}
      {showLabModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowLabModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Upload Lab Results</h2>
              <button onClick={() => setShowLabModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>

            <div style={{ background: 'var(--sage-light)', border: '1px solid var(--sage)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 20, fontSize: '0.82rem', color: 'var(--sage-dark)' }}>
              📄 Just upload the document — AI will read and analyze it for you. No typing required.
            </div>

            {labMsg && <div className={labMsg.includes('failed') ? 'error-message' : 'success-message'}>{labMsg}</div>}

            <div className="form-group">
              <label>Label *</label>
              <input
                value={labLabel}
                onChange={e => setLabLabel(e.target.value)}
                placeholder="e.g. CBC Bloodwork, MRI Results, Pathology Report"
              />
            </div>
            <div className="form-group">
              <label>Test date</label>
              <input type="date" value={labDate} onChange={e => setLabDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Upload document *</label>
              <input
  type="file"
  ref={labFileRef}
  accept=".pdf,.jpg,.jpeg,.png"
  multiple
  style={{ padding: '8px 0' }}
  onChange={e => setLabFile(Array.from(e.target.files))}
/>
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)', marginTop: 4 }}>
                PDF or image (JPG, PNG). AI will read the document directly.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowLabModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={uploadLabResult} disabled={labLoading || !labLabel || !labFile} style={{ flex: 1 }}>
                {labLoading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowUploadModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Upload Document</h2>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            {uploadMsg && <div className={uploadMsg.includes('failed') ? 'error-message' : 'success-message'}>{uploadMsg}</div>}
            <div className="form-group">
              <label>Document name *</label>
              <input value={uploadForm.name} onChange={e => setUploadForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Mom's DNR — signed 2024" />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={uploadForm.category} onChange={e => setUploadForm(p => ({ ...p, category: e.target.value }))}>
                {DOC_CATEGORIES.filter(c => c.id !== 'lab_results').map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea value={uploadForm.notes} onChange={e => setUploadForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any important details about this document..." rows={2} />
            </div>
            <div className="form-group">
              <label>File *</label>
              <input type="file" ref={fileRef} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ padding: '8px 0' }} />
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)', marginTop: 4 }}>PDF, images, or Word documents</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={uploadDocument} disabled={uploading || !uploadForm.name} style={{ flex: 1 }}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Trend Analysis Modal */}
      {showAIModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowAIModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>✨ AI Trend Analysis</h2>
              <button onClick={() => setShowAIModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            {aiLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <p style={{ color: 'var(--slate-light)' }}>Analyzing {labResults.length} lab documents...</p>
              </div>
            ) : (
              <div>
                <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, fontSize: '0.82rem', color: 'var(--slate)' }}>
                  ⚠️ For informational purposes only. Always discuss results with your doctor. For detailed per-document analysis, use the "✨ AI Analysis" button on each individual result.
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: 'var(--slate)', fontSize: '0.9rem' }}>{aiAnalysis}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
