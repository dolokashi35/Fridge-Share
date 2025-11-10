

import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import './chat.css';
import './marketplace-modern.css';
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';


const ChatPage = ({ currentUser }) => {
  const location = useLocation();
  const nav = useNavigate();
  const [messages, setMessages] = useState([]);
  const [messagesAll, setMessagesAll] = useState([]);
  const [to, setTo] = useState(() => (location.state && location.state.to) || '');
  const [selectedItem, setSelectedItem] = useState(() => (location.state && location.state.item) || null);
  const [fullItem, setFullItem] = useState(null);
  const [content, setContent] = useState(() => {
    const state = location.state || {};
    return state.source === 'buy' ? (state.prefill || '') : '';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const inputRef = useRef(null);
  const peerInitials = useMemo(() => {
    const name = to || 'User';
    const alpha = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return alpha.slice(0, 2) || 'US';
  }, [to]);
  const conversations = useMemo(() => {
    // Build unique peers with last message preview and time
    const map = new Map();
    for (const m of messagesAll) {
      const peer = m.from === currentUser ? m.to : m.from;
      if (!peer) continue;
      const key = `${peer}::${m.itemId || 'none'}`;
      const prev = map.get(key);
      if (!prev || new Date(m.timestamp) > new Date(prev.timestamp)) {
        map.set(key, {
          key,
          peer,
          itemId: m.itemId || null,
          itemName: m.itemName || '',
          itemImageUrl: m.itemImageUrl || '',
          preview: m.content,
          timestamp: m.timestamp
        });
      }
    }
    // If navigated with a peer but no messages yet, show it
    if (to) {
      const key = `${to}::${selectedItem?.id || 'none'}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          peer: to,
          itemId: selectedItem?.id || null,
          itemName: selectedItem?.name || '',
          itemImageUrl: selectedItem?.imageUrl || '',
          preview: selectedItem ? `New chat about ${selectedItem.name}` : 'New conversation',
          timestamp: new Date().toISOString()
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [messagesAll, currentUser, to, selectedItem]);
  const filteredMessages = useMemo(() => {
    if (!to) return [];
    return messages.filter(m => {
      const involved = (m.from === currentUser && m.to === to) || (m.to === currentUser && m.from === to);
      if (!involved) return false;
      if (selectedItem?.id) return (m.itemId === selectedItem.id);
      return true;
    });
  }, [messages, currentUser, to, selectedItem]);

  // Fetch thread messages for the selected peer/item
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const stored = localStorage.getItem('fs_user');
        const token = stored ? JSON.parse(stored)?.token : null;
        const params = to ? (selectedItem?.id ? { peer: to, itemId: selectedItem.id } : { peer: to }) : {};
        const res = await axios.get(`${BACKEND_URL}/api/messages`, {
          params,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setMessages(res.data.messages || []);
      } catch (err) {
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [to, selectedItem]);

  // Fetch all messages (for sidebar)
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const stored = localStorage.getItem('fs_user');
        const token = stored ? JSON.parse(stored)?.token : null;
        const res = await axios.get(`${BACKEND_URL}/api/messages`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setMessagesAll(res.data.messages || []);
      } catch {
        // ignore
      }
    };
    fetchAll();
  }, []);

  // Load full item details for the right panel when item context changes
  useEffect(() => {
    const loadItem = async () => {
      if (!selectedItem?.id) {
        setFullItem(null);
        return;
      }
      try {
        const stored = localStorage.getItem('fs_user');
        const token = stored ? JSON.parse(stored)?.token : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        // Try to get item with distance from nearby endpoint if user location is available
        let itemData = null;
        if (navigator.geolocation) {
          try {
            const position = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            const { latitude, longitude } = position.coords;
            const nearbyRes = await axios.get(`${BACKEND_URL}/api/items/nearby`, {
              params: { lat: latitude, lng: longitude, radius: 50000 },
              headers
            });
            const nearbyItem = nearbyRes.data.find(it => it._id === selectedItem.id);
            if (nearbyItem) {
              itemData = nearbyItem;
            }
          } catch {
            // Fallback to regular item fetch
          }
        }
        
        // If not found in nearby or geolocation failed, fetch regular item
        if (!itemData) {
          const res = await axios.get(`${BACKEND_URL}/items/${selectedItem.id}`, { headers });
          itemData = res.data;
        }
        
        setFullItem(itemData || null);
      } catch {
        setFullItem(null);
      }
    };
    loadItem();
  }, [selectedItem]);

  // Fetch purchase confirmation status
  useEffect(() => {
    const fetchConfirmation = async () => {
      if (!to || !selectedItem?.id) {
        setConfirmation(null);
        return;
      }
      try {
        const stored = localStorage.getItem('fs_user');
        const token = stored ? JSON.parse(stored)?.token : null;
        const res = await axios.get(`${BACKEND_URL}/api/purchase-confirmation`, {
          params: { itemId: selectedItem.id, peer: to },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setConfirmation(res.data.confirmation);
      } catch {
        setConfirmation(null);
      }
    };
    fetchConfirmation();
  }, [to, selectedItem]);

  // Send a message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!to || !content) return;
    try {
      setLoading(true);
      setError('');
      const stored = localStorage.getItem('fs_user');
      const token = stored ? JSON.parse(stored)?.token : null;
      await axios.post(
        `${BACKEND_URL}/api/messages`,
        { to, content, itemId: selectedItem?.id || null, itemName: selectedItem?.name || '', itemImageUrl: selectedItem?.imageUrl || '' },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setContent('');
      // Refresh messages
      const res = await axios.get(`${BACKEND_URL}/api/messages`, {
        params: selectedItem?.id ? { peer: to, itemId: selectedItem.id } : { peer: to },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setMessages(res.data.messages || []);
      // Refresh confirmation status
      if (selectedItem?.id && to) {
        try {
          const confRes = await axios.get(`${BACKEND_URL}/api/purchase-confirmation`, {
            params: { itemId: selectedItem.id, peer: to },
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          setConfirmation(confRes.data.confirmation);
        } catch {}
      }
      // Refresh sidebar conversations
      const allRes = await axios.get(`${BACKEND_URL}/api/messages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setMessagesAll(allRes.data.messages || []);
    } catch (err) {
      setError('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  // Handle purchase confirmation
  const handleConfirmPurchase = async () => {
    if (!to || !selectedItem?.id || confirming) return;
    // Show rating modal instead of directly confirming
    setShowItemModal(false);
    setShowRatingModal(true);
  };

  // Handle rating submission and confirmation
  const handleRatingSubmit = async () => {
    if (rating === 0) {
      alert("Please provide a rating to confirm purchase.");
      return;
    }
    if (!to || !selectedItem?.id || confirming) return;
    try {
      setConfirming(true);
      const stored = localStorage.getItem('fs_user');
      const token = stored ? JSON.parse(stored)?.token : null;
      const res = await axios.post(
        `${BACKEND_URL}/api/purchase-confirmation/confirm`,
        { itemId: selectedItem.id, peer: to, rating },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      
      if (res.data.completed) {
        // Both confirmed - navigate away
        setShowRatingModal(false);
        alert("Purchase completed! Chat and listing have been deleted.");
        nav("/marketplace");
      } else {
        // Update confirmation status
        setConfirmation(res.data.confirmation);
        setShowRatingModal(false);
        alert("Purchase confirmed! Waiting for the other party to confirm.");
      }
    } catch (err) {
      console.error("Confirm purchase error:", err);
      alert("Failed to confirm purchase. Please try again.");
    } finally {
      setConfirming(false);
      setRating(0);
    }
  };

  // Determine if current user has confirmed
  const stored = localStorage.getItem('fs_user');
  const currentUsername = stored ? JSON.parse(stored)?.username : null;
  const isSeller = fullItem?.username === currentUsername;
  const userConfirmed = confirmation ? (isSeller ? confirmation.sellerConfirmed : confirmation.buyerConfirmed) : false;
  const otherConfirmed = confirmation ? (isSeller ? confirmation.buyerConfirmed : confirmation.sellerConfirmed) : false;

  return (
    <div className="chat-bg">
      <div className="chat-card">
        {/* Sidebar */}
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">Messages</div>
          <input className="chat-search" placeholder="Search" />
          <div className="chat-list">
            {conversations.length === 0 ? (
              <div className="offer-meta">No conversations yet.</div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.key}
                  className={"chat-list-item " + (to === c.peer && ((selectedItem?.id || null) === (c.itemId || null)) ? "active" : "")}
                  onClick={() => {
                    setTo(c.peer);
                    setSelectedItem(c.itemId ? { id: c.itemId, name: c.itemName, imageUrl: c.itemImageUrl } : null);
                    setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
                  }}
                >
                  <div className="chat-peer-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
                    {(c.peer || 'U').slice(0,2).toUpperCase()}
                  </div>
                  <div className="meta">
                    <div className="name">{c.peer}</div>
                    <div className="preview">
                      <span className="preview-text">{c.preview}</span>
                    </div>
                  </div>
                  {c.itemImageUrl && (
                    <img 
                      src={c.itemImageUrl} 
                      alt="" 
                      className="chat-item-thumbnail"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main chat area */}
        <section className="chat-main">
          <div className="chat-header">
            <div className="chat-peer-avatar">{peerInitials}</div>
            <div className="chat-peer-title">
              <div className="chat-peer-name">{to || 'Conversation'}</div>
              <div className="chat-peer-sub">
                {selectedItem?.imageUrl ? (
                  <img src={selectedItem.imageUrl} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} />
                ) : 'Secure • Direct message'}
              </div>
            </div>
          </div>

          {error && <div className="chat-error">{error}</div>}

          <div className="chat-body">
            {loading && filteredMessages.length === 0 ? (
              <div className="offer-meta">Loading…</div>
            ) : filteredMessages.length === 0 ? (
              <>
                <div className="chat-security-warning">
                  <div className="chat-security-icon">🛡️</div>
                  <div className="chat-security-text">
                    Keep it on FridgeShare. Never share personal info like your email address or phone number. To stay protected, don't follow links to buy or sell outside of FridgeShare. Click the Buy button to purchase.
                  </div>
                </div>
                <div className="offer-meta">Say hello and propose a time and place.</div>
              </>
            ) : (() => {
              // Group messages by date and render with date headers
              const grouped = [];
              let currentDate = null;
              
              filteredMessages.forEach((msg, idx) => {
                const msgDate = new Date(msg.timestamp);
                const dateStr = msgDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                const timeStr = msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                
                // Check if we need a date header
                if (dateStr !== currentDate) {
                  currentDate = dateStr;
                  grouped.push({ type: 'date', date: dateStr, fullDate: msgDate });
                }
                
                // Add the message
                grouped.push({ type: 'message', ...msg, timeStr });
              });
              
              // Add security warning at the start if there are messages
              if (grouped.length > 0) {
                grouped.unshift({ type: 'security' });
              }
              
              return grouped.map((item, idx) => {
                if (item.type === 'security') {
                  return (
                    <div key={`security-${idx}`} className="chat-security-warning">
                      <div className="chat-security-icon">🛡️</div>
                      <div className="chat-security-text">
                        Keep it on FridgeShare. Never share personal info like your email address or phone number. To stay protected, don't follow links to buy or sell outside of FridgeShare. Click the Buy button to purchase.
                      </div>
                    </div>
                  );
                }
                if (item.type === 'date') {
                  return (
                    <div key={`date-${idx}`} className="chat-date-header">
                      {item.date}
                    </div>
                  );
                }
                const isSelf = item.from === currentUser;
                return (
                  <div key={item.id || idx} className={"chat-row " + (isSelf ? "self" : "")}>
                    {!isSelf && (
                      <div className="chat-peer-avatar">
                        {(item.from || 'U').slice(0,2).toUpperCase()}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '72%' }}>
                      <div className={"bubble " + (isSelf ? "self" : "")}>
                        <div className="bubble-content">{item.content}</div>
                      </div>
                      <div className="bubble-time">
                        {item.timeStr}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          <form className="chat-composer" onSubmit={handleSend}>
            {!to && (
          <input
            type="text"
            className="chat-input"
            placeholder="Send to (username)"
            value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{ maxWidth: 180 }}
          />
            )}
          <input
            type="text"
            className="chat-input"
              placeholder="Type your message..."
            value={content}
              onChange={(e) => setContent(e.target.value)}
              ref={inputRef}
              autoFocus
            />
            <button className="chat-send" type="submit" disabled={loading || !to || !content.trim()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
              </svg>
            </button>
        </form>
        </section>

        {/* Right listing panel */}
        <aside className="chat-right">
          <div className="chat-right-header">Listing</div>
          <div className="listing-panel">
            {fullItem && (
              <>
                <div 
                  className="market-card mylist-card" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowItemModal(true)}
                >
                  <div style={{ position: 'relative' }}>
                    <img
                    src={fullItem?.imageUrl || selectedItem?.imageUrl || selectedItem?.img || 'https://images.unsplash.com/photo-1574226516831-e1dff420e12f?auto=format&fit=crop&w=600&q=60'}
                    alt={fullItem?.name || selectedItem?.name || 'Item'}
                    className="market-img"
                  />
                </div>
                  <div className="market-card-content">
                    <h3 className="market-card-title">{fullItem?.name || selectedItem?.name || 'Item'}</h3>
                    <div style={{ marginBottom: '0.5rem' }}>
                      {fullItem?.category && (
                        <p className="market-card-meta" style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                          {fullItem.category}
                        </p>
                      )}
                      {typeof fullItem?.distance === 'number' && (
                        <p className="market-card-meta" style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                          {(fullItem.distance * 0.621371).toFixed(1)} mi away
                        </p>
                      )}
                    </div>
                    <div className="market-card-info-line">
                      {typeof fullItem?.price === 'number' && (
                        <>
                          <span className="market-card-price">${fullItem.price.toFixed(2)}</span>
                          <span className="market-card-separator">•</span>
                        </>
                      )}
                      <span className="market-card-meta">Qty: {fullItem?.quantity ?? 'N/A'}</span>
                    </div>
                    {fullItem?.description && (
                      <p className="market-card-description">{fullItem.description}</p>
                    )}
                    {fullItem?.username && (
                      <p className="market-card-meta" style={{ marginTop: '0.25rem' }}>
                        Posted by: <b>{fullItem.username}</b>
                      </p>
                    )}
                    {fullItem?.createdAt && (
                      <p className="market-card-meta" style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                        {new Date(fullItem.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
                {to && selectedItem?.id && (
                  <div style={{ marginTop: 'auto', paddingTop: '16px', width: '100%' }}>
                    {confirmation && otherConfirmed && !userConfirmed && (
                      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '12px', textAlign: 'center' }}>
                        Waiting for {isSeller ? 'buyer' : 'seller'} to confirm
                      </p>
                    )}
                    {confirmation && userConfirmed && !otherConfirmed && (
                      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '12px', textAlign: 'center' }}>
                        Waiting for {isSeller ? 'buyer' : 'seller'} to confirm
                      </p>
                    )}
                    {confirmation && userConfirmed && otherConfirmed && (
                      <p style={{ fontSize: '0.875rem', color: '#16a34a', marginBottom: '12px', textAlign: 'center', fontWeight: 600 }}>
                        Both parties confirmed
                      </p>
                    )}
                    <button
                      onClick={handleConfirmPurchase}
                      disabled={confirming || (confirmation && userConfirmed)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: confirmation && userConfirmed ? '#94a3b8' : '#0E7490',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        cursor: (confirming || (confirmation && userConfirmed)) ? 'not-allowed' : 'pointer',
                        opacity: (confirming || (confirmation && userConfirmed)) ? 0.6 : 1,
                        boxSizing: 'border-box',
                      }}
                    >
                      {confirming ? 'Confirming...' : (confirmation && userConfirmed) ? 'Confirmed' : 'Confirm Purchase'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Item Detail Modal */}
        {showItemModal && fullItem && (
          <div className="item-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowItemModal(false)}>
            <div className="item-modal-content">
              <button className="item-modal-close" onClick={() => setShowItemModal(false)}>×</button>
              <img
                src={fullItem?.imageUrl || selectedItem?.imageUrl || selectedItem?.img || 'https://images.unsplash.com/photo-1574226516831-e1dff420e12f?auto=format&fit=crop&w=600&q=60'}
                alt={fullItem?.name || selectedItem?.name || 'Item'}
                className="item-modal-image"
              />
              <div className="item-modal-body">
                <h2 className="item-modal-title">{fullItem?.name || selectedItem?.name || 'Item'}</h2>
                <div className="market-card-info-line" style={{ marginBottom: '12px' }}>
                  {typeof fullItem?.price === 'number' && (
                    <>
                      <span className="market-card-price">${fullItem.price.toFixed(2)}</span>
                      <span className="market-card-separator">•</span>
                    </>
                  )}
                  <span className="market-card-meta">Qty: {fullItem?.quantity ?? 'N/A'}</span>
                  {typeof fullItem?.distance === 'number' && (
                    <>
                      <span className="market-card-separator">•</span>
                      <span className="market-card-meta">{(fullItem.distance * 0.621371).toFixed(1)} mi</span>
                    </>
                  )}
              </div>
                {fullItem?.description && (
                  <p className="item-modal-description">{fullItem.description}</p>
                )}
                {fullItem?.username && (
                  <p className="item-modal-meta">
                    <strong>Posted by:</strong> {fullItem.username}
                  </p>
                )}
                {fullItem?.createdAt && (
                  <p className="item-modal-meta">
                    <strong>Posted:</strong> {new Date(fullItem.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
          )}
        </div>
            </div>
          </div>
        )}

        {/* Rating Modal */}
        {showRatingModal && (
          <div className="item-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowRatingModal(false)}>
            <div className="item-modal-content" style={{ maxWidth: '400px' }}>
              <button className="item-modal-close" onClick={() => setShowRatingModal(false)}>×</button>
              <div style={{ padding: '30px', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Rate Your Experience</h2>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>
                  How was your transaction with {to}?
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '2.5rem',
                        color: (hoverRating >= star || rating >= star) ? '#FFD700' : '#E5E7EB',
                        transition: 'color 0.2s',
                        padding: '0',
                        lineHeight: '1',
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '0.9rem' }}>
                    {rating === 1 && 'Poor'}
                    {rating === 2 && 'Fair'}
                    {rating === 3 && 'Good'}
                    {rating === 4 && 'Very Good'}
                    {rating === 5 && 'Excellent'}
                  </p>
                )}
                <button
                  onClick={handleRatingSubmit}
                  disabled={rating === 0 || confirming}
                  className="item-modal-btn-buy"
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: rating === 0 ? '#D1D5DB' : '#0E7490',
                    cursor: rating === 0 || confirming ? 'not-allowed' : 'pointer',
                    opacity: rating === 0 || confirming ? 0.6 : 1,
                  }}
                >
                  {confirming ? 'Confirming...' : 'Confirm Purchase'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
