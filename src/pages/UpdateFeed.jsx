import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const REACTIONS = ['❤️', '🙏', '💪', '😢', '⭐']

export default function UpdateFeed({ patient }) {
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [newPost, setNewPost] = useState('')
  const [mood, setMood] = useState('stable')
  const [showCommentBox, setShowCommentBox] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const textareaRef = useRef(null)

  const isAdmin = profile?.role === 'admin' || !profile?.role
  const canPost = isAdmin

  useEffect(() => {
    if (patient?.id) fetchPosts()
  }, [patient])

  const fetchPosts = async () => {
    setLoading(true)
    const { data: postsData } = await supabase
      .from('updates')
      .select('*, profiles(full_name)')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })

    if (postsData) {
      const postsWithDetails = await Promise.all(postsData.map(async (post) => {
        const { data: reactions } = await supabase
          .from('update_reactions')
          .select('*')
          .eq('update_id', post.id)

        const { data: comments } = await supabase
          .from('update_comments')
          .select('*, profiles(full_name)')
          .eq('update_id', post.id)
          .order('created_at', { ascending: true })

        return { ...post, reactions: reactions || [], comments: comments || [] }
      }))
      setPosts(postsWithDetails)
    }
    setLoading(false)
  }

  const submitPost = async () => {
    if (!newPost.trim()) return
    setPosting(true)
    try {
      await supabase.from('updates').insert({
        patient_id: patient.id,
        author_id: user.id,
        content: newPost.trim(),
        mood,
      })
      setNewPost('')
      setMood('stable')
      await fetchPosts()
    } finally {
      setPosting(false)
    }
  }

  const toggleReaction = async (postId, emoji) => {
    const existing = posts
      .find(p => p.id === postId)?.reactions
      .find(r => r.user_id === user.id && r.emoji === emoji)

    if (existing) {
      await supabase.from('update_reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('update_reactions').insert({ update_id: postId, user_id: user.id, emoji })
    }
    await fetchPosts()
  }

  const submitComment = async (postId) => {
    if (!commentText.trim()) return
    setCommentLoading(true)
    try {
      await supabase.from('update_comments').insert({
        update_id: postId,
        author_id: user.id,
        content: commentText.trim(),
      })
      setCommentText('')
      setShowCommentBox(null)
      await fetchPosts()
    } finally {
      setCommentLoading(false)
    }
  }

  const moodConfig = {
    great:    { label: 'Doing great',    color: '#68D391', bg: '#F0FFF4' },
    good:     { label: 'Doing well',     color: '#63B3ED', bg: '#EBF8FF' },
    stable:   { label: 'Stable',         color: '#D4956A', bg: '#FDF0E8' },
    tough:    { label: 'Tough day',      color: '#FC8181', bg: '#FFF5F5' },
    critical: { label: 'Needs prayer',   color: '#B794F4', bg: '#FAF5FF' },
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Update Feed</h1>
        <p className="page-subtitle">Stay informed on {patient?.name}'s journey</p>
      </div>

      {/* Compose Box - Admin only */}
      {canPost && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">Post an Update</div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>How is {patient?.name} doing today?</label>
            <select value={mood} onChange={e => setMood(e.target.value)} style={{ marginBottom: 12 }}>
              {Object.entries(moodConfig).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <textarea
              ref={textareaRef}
              value={newPost}
              onChange={e => setNewPost(e.target.value)}
              placeholder={`Share what's happening with ${patient?.name}. Your care team is listening...`}
              rows={4}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              style={{ width: 'auto', minWidth: 140 }}
              onClick={submitPost}
              disabled={posting || !newPost.trim()}
            >
              {posting ? 'Posting...' : 'Post Update'}
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p style={{ fontSize: '3rem', marginBottom: 16 }}>📢</p>
            <h3>No updates yet</h3>
            <p>{canPost ? 'Post your first update above to keep everyone informed.' : 'Check back soon for updates.'}</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {posts.map(post => {
            const mood = moodConfig[post.mood] || moodConfig.stable
            const myReactions = post.reactions.filter(r => r.user_id === user.id).map(r => r.emoji)

            return (
              <div key={post.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Mood bar */}
                <div style={{ height: 4, background: mood.color, opacity: 0.7 }} />

                <div style={{ padding: 24 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="member-avatar">{getInitials(post.profiles?.full_name || '')}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--navy)' }}>
                          {post.profiles?.full_name || 'Admin'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--slate-light)' }}>{formatDate(post.created_at)}</div>
                      </div>
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: mood.bg, color: mood.color,
                      padding: '4px 12px', borderRadius: 20,
                      fontSize: '0.78rem', fontWeight: 600,
                      border: `1px solid ${mood.color}33`
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: mood.color, display: 'inline-block' }} />
                      {mood.label}
                    </div>
                  </div>

                  {/* Content */}
                  <p style={{ color: 'var(--slate)', lineHeight: 1.7, fontSize: '0.95rem', marginBottom: 20 }}>
                    {post.content}
                  </p>

                  {/* Reaction counts */}
                  {post.reactions.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                      {REACTIONS.map(emoji => {
                        const count = post.reactions.filter(r => r.emoji === emoji).length
                        if (!count) return null
                        return (
                          <span key={emoji} style={{
                            background: 'var(--cream)', border: '1px solid var(--border)',
                            borderRadius: 20, padding: '3px 10px', fontSize: '0.82rem',
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                            {emoji} {count}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Reaction buttons */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    {REACTIONS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(post.id, emoji)}
                        style={{
                          background: myReactions.includes(emoji) ? 'var(--sage-light)' : 'transparent',
                          border: `1px solid ${myReactions.includes(emoji) ? 'var(--sage)' : 'var(--border)'}`,
                          borderRadius: 8, padding: '6px 10px', fontSize: '1rem',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowCommentBox(showCommentBox === post.id ? null : post.id)}
                      style={{
                        marginLeft: 'auto', background: 'transparent',
                        border: '1px solid var(--border)', borderRadius: 8,
                        padding: '6px 14px', fontSize: '0.82rem', cursor: 'pointer',
                        color: 'var(--slate-light)', fontFamily: 'var(--font-body)'
                      }}
                    >
                      💬 {post.comments.length > 0 ? post.comments.length : ''} Comment
                    </button>
                  </div>

                  {/* Comments */}
                  {post.comments.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                      {post.comments.map(comment => (
                        <div key={comment.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div className="member-avatar" style={{ width: 30, height: 30, fontSize: '0.72rem', flexShrink: 0 }}>
                            {getInitials(comment.profiles?.full_name || '')}
                          </div>
                          <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '8px 14px', flex: 1, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy)', marginBottom: 2 }}>
                              {comment.profiles?.full_name || 'Member'}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--slate)' }}>{comment.content}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment input */}
                  {showCommentBox === post.id && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="Leave a message of support..."
                        rows={2}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)',
                          borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: '0.875rem',
                          color: 'var(--navy)', background: 'white', outline: 'none', resize: 'none'
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--sage)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                      <button
                        className="btn btn-primary"
                        style={{ width: 'auto', padding: '10px 18px' }}
                        onClick={() => submitComment(post.id)}
                        disabled={commentLoading || !commentText.trim()}
                      >
                        Send
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
