import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function MemoryWall({ patient, userRole }) {
  const { user, profile } = useAuth()
  const isAdmin = userRole === 'admin'
  const [media, setMedia] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadForm, setUploadForm] = useState({ caption: '', author_name: '' })
  const [uploadMsg, setUploadMsg] = useState('')
  const [activeView, setActiveView] = useState('approved')
  const fileRef = useRef(null)

  useEffect(() => {
    if (patient?.id) {
      fetchMedia()
    }
  }, [patient])

  const fetchMedia = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('memory_wall')
      .select('*')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
    const approved = (data || []).filter(m => m.status === 'approved')
    const pendingItems = (data || []).filter(m => m.status === 'pending')
    setMedia(approved)
    setPending(pendingItems)
    setLoading(false)
  }

  const uploadMedia = async () => {
    const file = fileRef.current?.files[0]
    if (!file) return
    setUploading(true)
    setUploadMsg('')
    try {
      const ext = file.name.split('.').pop()
      const path = `${patient.id}/memory/${Date.now()}.${ext}`
      const { error: storageError } = await supabase.storage.from('memory-wall').upload(path, file)
      if (storageError) throw storageError

      const { data: { publicUrl } } = supabase.storage.from('memory-wall').getPublicUrl(path)
      const isVideo = file.type.startsWith('video/')

      await supabase.from('memory_wall').insert({
        patient_id: patient.id,
        uploaded_by: user.id,
        author_name: uploadForm.author_name || profile?.full_name || 'Anonymous',
        caption: uploadForm.caption,
        file_url: publicUrl,
        file_type: isVideo ? 'video' : 'photo',
        storage_path: path,
        status: isAdmin ? 'approved' : 'pending',
      })

      setUploadMsg(isAdmin ? 'Added to Memory Wall!' : 'Submitted for approval!')
      setUploadForm({ caption: '', author_name: '' })
      if (fileRef.current) fileRef.current.value = ''
      await fetchMedia()
      setTimeout(() => { setShowUploadModal(false); setUploadMsg('') }, 1200)
    } catch (err) {
      setUploadMsg('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const approveMedia = async (id) => {
    await supabase.from('memory_wall').update({ status: 'approved' }).eq('id', id)
    await fetchMedia()
  }

  const deleteMedia = async (item) => {
    if (!confirm('Remove this from the Memory Wall?')) return
    await supabase.storage.from('memory-wall').remove([item.storage_path])
    await supabase.from('memory_wall').delete().eq('id', item.id)
    await fetchMedia()
  }

  const formatTimeAgo = (d) => {
    const diff = new Date() - new Date(d)
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
    if (diff < 2592000000) return Math.floor(diff / 86400000) + 'd ago'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Memory Wall</h1>
          <p className="page-subtitle">Photos and video messages for {patient?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && pending.length > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveView(activeView === 'pending' ? 'approved' : 'pending')}
            >
              {activeView === 'pending' ? '← Back to Wall' : `⏳ Review (${pending.length})`}
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>
            + Add Memory
          </button>
        </div>
      </div>

      {/* Pending review banner for admin */}
      {isAdmin && pending.length > 0 && activeView === 'approved' && (
        <div style={{
          background: 'var(--amber-light)', border: '1px solid var(--amber)',
          borderRadius: 'var(--radius)', padding: '14px 20px', marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--slate)' }}>
            ⏳ <strong>{pending.length} item{pending.length > 1 ? 's' : ''}</strong> waiting for your approval
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setActiveView('pending')}>
            Review Now
          </button>
        </div>
      )}

      {/* Pending items view */}
      {activeView === 'pending' && isAdmin && (
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--navy)', marginBottom: 16 }}>
            Pending Approval ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '2rem', marginBottom: 8 }}>✓</p>
              <h3>All caught up!</h3>
              <p>No items waiting for approval.</p>
            </div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {pending.map(item => (
                <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {item.file_type === 'video' ? (
                    <video src={item.file_url} controls style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block', background: '#000' }} />
                  ) : (
                    <img src={item.file_url} alt={item.caption} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
                  )}
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy)', marginBottom: 2 }}>{item.author_name}</div>
                    {item.caption && <div style={{ fontSize: '0.82rem', color: 'var(--slate)', marginBottom: 10 }}>{item.caption}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => approveMedia(item.id)}>✓ Approve</button>
                      <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => deleteMedia(item)}>✗ Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main wall */}
      {activeView === 'approved' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : media.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>📸</p>
              <h3>The Memory Wall is empty</h3>
              <p style={{ marginBottom: 16 }}>
                Upload photos and video messages to create a living scrapbook for {patient?.name}.
              </p>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowUploadModal(true)}>
                Add First Memory
              </button>
            </div></div>
          ) : (
            <div style={{ columns: '3 280px', gap: 16 }}>
              {media.map(item => (
                <div key={item.id} style={{
                  breakInside: 'avoid', marginBottom: 16,
                  background: 'white', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {item.file_type === 'video' ? (
                    <video
                      src={item.file_url}
                      controls
                      style={{ width: '100%', display: 'block', background: '#000' }}
                    />
                  ) : (
                    <img
                      src={item.file_url}
                      alt={item.caption || 'Memory'}
                      style={{ width: '100%', display: 'block' }}
                    />
                  )}
                  <div style={{ padding: '12px 16px' }}>
                    {item.caption && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--slate)', lineHeight: 1.5, marginBottom: 8, fontStyle: 'italic' }}>
                        "{item.caption}"
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--navy)' }}>{item.author_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)' }}>{formatTimeAgo(item.created_at)}</div>
                      </div>
                      {isAdmin && (
                        <button onClick={() => deleteMedia(item)} style={{
                          background: 'none', border: 'none', color: 'var(--slate-light)',
                          cursor: 'pointer', fontSize: '1rem', padding: '4px'
                        }}>×</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }} onClick={e => { if (e.target === e.currentTarget) setShowUploadModal(false) }}>
          <div style={{
            background: 'white', borderRadius: 'var(--radius)', padding: 32,
            width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Add a Memory</h2>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>

            {uploadMsg && (
              <div className={uploadMsg.includes('failed') ? 'error-message' : 'success-message'}>{uploadMsg}</div>
            )}

            {!isAdmin && (
              <div style={{
                background: 'var(--sage-light)', border: '1px solid var(--sage)',
                borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16,
                fontSize: '0.82rem', color: 'var(--sage-dark)'
              }}>
                📋 Your submission will be reviewed by the admin before appearing on the wall.
              </div>
            )}

            <div className="form-group">
              <label>Your name</label>
              <input
                value={uploadForm.author_name}
                onChange={e => setUploadForm(p => ({ ...p, author_name: e.target.value }))}
                placeholder={profile?.full_name || 'Your name'}
              />
            </div>
            <div className="form-group">
              <label>Caption (optional)</label>
              <textarea
                value={uploadForm.caption}
                onChange={e => setUploadForm(p => ({ ...p, caption: e.target.value }))}
                placeholder="Share a memory or message of love..."
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Photo or video *</label>
              <input
                type="file"
                ref={fileRef}
                accept="image/*,video/*"
                style={{ padding: '8px 0' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)', marginTop: 4 }}>
                Photos (JPG, PNG) or short videos (MP4, MOV)
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={uploadMedia} disabled={uploading} style={{ flex: 1 }}>
                {uploading ? 'Uploading...' : isAdmin ? 'Add to Wall' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
