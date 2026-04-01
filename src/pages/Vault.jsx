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
  const [labForm, setLabForm] = useState({ test_name: '', test_date: '', results: '', notes: '' })
  const [labLoading, setLabLoading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
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
      const { error: storageError } = await supabase.storage
        .from('vault')
        .upload(path, file)
      if (storageError) throw storageError

      const { data: { publicUrl } } = supabase.storage.from('vault').getPublicUrl(path)

      await supabase.from('vault_documents').insert({
        patient_id: patient.id,
        uploaded_by: user.id,
        name: uploadForm.name,
        category: uploadForm.category,
        notes: uploadForm.notes,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: path,
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

  const uploadLabResult = async () => {
    if (!labForm.test_name || !labForm.test_date || !labForm.results) return
    setLabLoading(true)
    try {
      let fileUrl = null
      let fileName = null
      const file = labFileRef.current?.files[0]
      if (file) {
        const ext = file.name.split('.').pop()
        const path = `${patient.id}/labs/${Date.now()}.${ext}`
        await supabase.storage.from('vault').upload(path, file)
        const { data: { publicUrl } } = supabase.storage.from('vault').getPublicUrl(path)
        fileUrl = publicUrl
        fileName = file.name
      }

      await supabase.from('lab_results').insert({
        patient_id: patient.id,
        uploaded_by: user.id,
        test_name: labForm.test_name,
        test_date: labForm.test_date,
        results: labForm.results,
        notes: labForm.notes,
        file_url: fileUrl,
        file_name: fileName,
      })
      setLabForm({ test_name: '', test_date: '', results: '', notes: '' })
      if (labFileRef.current) labFileRef.current.value = ''
      await fetchLabResults()
      setShowLabModal(false)
    } finally {
      setLabLoading(false)
    }
  }

  const analyzeLabTrends = async () => {
    if (labResults.length === 0) return
    setAiLoading(true)
    setShowAIModal(true)
    setAiAnalysis('')
    try {
      const labSummary = labResults.map(r =>
        `Test: ${r.test_name} | Date: ${r.test_date} | Results: ${r.results}${r.notes ? ' | Notes: ' + r.notes : ''}`
      ).join('\n')

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are a compassionate medical assistant helping a family caregiver understand their loved one's lab results. 
The patient has the following conditions: ${patient.primary_diagnosis || 'not specified'}, ${patient.other_conditions || ''}.
Analyze the lab results provided, identify any trends, flag anything concerning, and suggest questions to ask the doctor.
Be warm, clear, and avoid overwhelming medical jargon. Always remind the family to discuss findings with their doctor.
Format your response with clear sections: Summary, Trends to Watch, Questions to Ask Your Doctor.`,
          messages: [{ role: 'user', content: `Please analyze these lab results for ${patient.name}:\n\n${labSummary}` }]
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

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const filteredDocs = activeTab === 'all' ? documents
    : activeTab === 'labs' ? []
    : documents.filter(d => d.category === activeTab)

  const getCategoryInfo = (id) => DOC_CATEGORIES.find(c => c.id === id) || { emoji: '📄', label: id }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">The Vault</h1>
          <p className="page-subtitle">Secure documents for {patient?.name}'s care</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowLabModal(true)}>
            🔬 Add Lab Result
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>
            + Upload Document
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '8px 16px', borderRadius: 20, border: '1.5px solid',
            borderColor: activeTab === 'all' ? 'var(--sage)' : 'var(--border)',
            background: activeTab === 'all' ? 'var(--sage-light)' : 'white',
            color: activeTab === 'all' ? 'var(--sage-dark)' : 'var(--slate)',
            fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)'
          }}
        >
          All Documents ({documents.length})
        </button>
        {DOC_CATEGORIES.map(cat => {
          const count = cat.id === 'lab_results' ? labResults.length : documents.filter(d => d.category === cat.id).length
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id === 'lab_results' ? 'labs' : cat.id)}
              style={{
                padding: '8px 16px', borderRadius: 20, border: '1.5px solid',
                borderColor: activeTab === (cat.id === 'lab_results' ? 'labs' : cat.id) ? 'var(--sage)' : 'var(--border)',
                background: activeTab === (cat.id === 'lab_results' ? 'labs' : cat.id) ? 'var(--sage-light)' : 'white',
                color: activeTab === (cat.id === 'lab_results' ? 'labs' : cat.id) ? 'var(--sage-dark)' : 'var(--slate)',
                fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)'
              }}
            >
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
            {labResults.length > 0 && (
              <button className="btn btn-primary btn-sm" onClick={analyzeLabTrends}>
                ✨ AI Trend Analysis
              </button>
            )}
          </div>

          {labResults.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <p style={{ fontSize: '3rem', marginBottom: 12 }}>🔬</p>
                <h3>No lab results yet</h3>
                <p style={{ marginBottom: 16 }}>Upload bloodwork, MRI results, or any test results to track trends over time.</p>
                <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowLabModal(true)}>
                  Add First Lab Result
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {labResults.map(lab => (
                <div key={lab.id} className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: '1.2rem' }}>🔬</span>
                        <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{lab.test_name}</div>
                        <div style={{
                          fontSize: '0.75rem', color: 'var(--slate-light)',
                          background: 'var(--cream)', padding: '2px 10px',
                          borderRadius: 20, border: '1px solid var(--border)'
                        }}>
                          {formatDate(lab.test_date)}
                        </div>
                      </div>
                      <div style={{
                        background: 'var(--cream)', borderRadius: 'var(--radius-sm)',
                        padding: '12px 16px', fontSize: '0.875rem', color: 'var(--slate)',
                        lineHeight: 1.6, marginBottom: lab.notes ? 8 : 0
                      }}>
                        {lab.results}
                      </div>
                      {lab.notes && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--slate-light)', marginTop: 6, fontStyle: 'italic' }}>
                          Note: {lab.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                      {lab.file_url && (
                        <a href={lab.file_url} target="_blank" rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm">View File</a>
                      )}
                    </div>
                  </div>
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
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <p style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</p>
                <h3>No documents yet</h3>
                <p style={{ marginBottom: 16 }}>
                  {activeTab === 'all'
                    ? 'Upload important documents to keep everything in one secure place.'
                    : `No ${getCategoryInfo(activeTab).label.toLowerCase()} uploaded yet.`}
                </p>
                <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowUploadModal(true)}>
                  Upload First Document
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {filteredDocs.map(doc => {
                const cat = getCategoryInfo(doc.category)
                return (
                  <div key={doc.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: 'var(--sage-light)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.3rem', flexShrink: 0
                      }}>
                        {cat.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem', marginBottom: 2 }}>
                          {doc.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)' }}>
                          {cat.label} · {formatSize(doc.file_size)}
                        </div>
                      </div>
                    </div>
                    {doc.notes && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--slate)', lineHeight: 1.5 }}>{doc.notes}</div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)' }}>
                      Uploaded {formatDate(doc.created_at)} by {doc.profiles?.full_name || 'Admin'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <a
                        href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
                      >
                        View
                      </a>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteDocument(doc)}
                        style={{ flex: 1 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }} onClick={e => { if (e.target === e.currentTarget) setShowUploadModal(false) }}>
          <div style={{
            background: 'white', borderRadius: 'var(--radius)', padding: 32,
            width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-lg)'
          }}>
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

      {/* Add Lab Result Modal */}
      {showLabModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }} onClick={e => { if (e.target === e.currentTarget) setShowLabModal(false) }}>
          <div style={{
            background: 'white', borderRadius: 'var(--radius)', padding: 32,
            width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Add Lab Result</h2>
              <button onClick={() => setShowLabModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            <div className="form-group">
              <label>Test name *</label>
              <input value={labForm.test_name} onChange={e => setLabForm(p => ({ ...p, test_name: e.target.value }))} placeholder="e.g. Complete Blood Count (CBC)" />
            </div>
            <div className="form-group">
              <label>Test date *</label>
              <input type="date" value={labForm.test_date} onChange={e => setLabForm(p => ({ ...p, test_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Results *</label>
              <textarea
                value={labForm.results}
                onChange={e => setLabForm(p => ({ ...p, results: e.target.value }))}
                placeholder="Paste or type the results here. e.g. Hemoglobin: 11.2 g/dL (low), WBC: 6.4 (normal), Platelets: 210 (normal)"
                rows={4}
              />
            </div>
            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea value={labForm.notes} onChange={e => setLabForm(p => ({ ...p, notes: e.target.value }))} placeholder="Doctor's comments, context, next steps..." rows={2} />
            </div>
            <div className="form-group">
              <label>Attach file (optional)</label>
              <input type="file" ref={labFileRef} accept=".pdf,.jpg,.jpeg,.png" style={{ padding: '8px 0' }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowLabModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={uploadLabResult} disabled={labLoading || !labForm.test_name || !labForm.test_date || !labForm.results} style={{ flex: 1 }}>
                {labLoading ? 'Saving...' : 'Save Result'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {showAIModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }} onClick={e => { if (e.target === e.currentTarget) setShowAIModal(false) }}>
          <div style={{
            background: 'white', borderRadius: 'var(--radius)', padding: 32,
            width: '100%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>
                ✨ AI Lab Trend Analysis
              </h2>
              <button onClick={() => setShowAIModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>

            {aiLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <p style={{ color: 'var(--slate-light)' }}>Analyzing {labResults.length} lab results...</p>
              </div>
            ) : (
              <div>
                <div style={{
                  background: 'var(--amber-light)', border: '1px solid var(--amber)',
                  borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20,
                  fontSize: '0.82rem', color: 'var(--slate)'
                }}>
                  ⚠️ This analysis is for informational purposes only. Always discuss results with your doctor.
                </div>
                <div style={{
                  whiteSpace: 'pre-wrap', lineHeight: 1.8, color: 'var(--slate)',
                  fontSize: '0.9rem'
                }}>
                  {aiAnalysis}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
