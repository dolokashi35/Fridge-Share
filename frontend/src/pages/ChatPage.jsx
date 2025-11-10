

import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import './chat.css';
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';


const ChatPage = ({ currentUser }) => {
  const location = useLocation();
  const nav = useNavigate();
  const [messages, setMessages] = useState([]);
  const [to, setTo] = useState(() => (location.state && location.state.to) || '');
  const [selectedItem, setSelectedItem] = useState(() => (location.state && location.state.item) || null);
  const [content, setContent] = useState(() => {
    const state = location.state || {};
    return state.source === 'buy' ? (state.prefill || '') : '';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const peerInitials = useMemo(() => {
    const name = to || 'User';
    const alpha = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return alpha.slice(0, 2) || 'US';
  }, [to]);
  const conversations = useMemo(() => {
    // Build unique peers with last message preview and time
    const map = new Map();
    for (const m of messages) {
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
  }, [messages, currentUser, to, selectedItem]);
  const filteredMessages = useMemo(() => {
    if (!to) return [];
    return messages.filter(m => {
      const involved = (m.from === currentUser && m.to === to) || (m.to === currentUser && m.from === to);
      if (!involved) return false;
      if (selectedItem?.id) return (m.itemId === selectedItem.id);
      return true;
    });
  }, [messages, currentUser, to, selectedItem]);

  // Fetch messages
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
    } catch (err) {
      setError('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

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
                  <div className="chat-peer-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                    {(c.peer || 'U').slice(0,2).toUpperCase()}
                  </div>
                  <div className="meta">
                    <div className="name">{c.peer}</div>
                    <div className="preview">
                      {c.itemImageUrl ? <img src={c.itemImageUrl} alt="" style={{ width: 18, height: 18, borderRadius: 4, verticalAlign: 'middle', marginRight: 6 }} /> : null}
                      <span className="preview-text">{c.preview}</span>
                    </div>
                  </div>
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
              <div className="offer-meta">Say hello and propose a time and place.</div>
            ) : (
              filteredMessages.map((msg) => {
                const isSelf = msg.from === currentUser;
                return (
                  <div key={msg.id} className={"chat-row " + (isSelf ? "self" : "")}>
                    {!isSelf && <div className="chat-peer-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{(msg.from || 'U').slice(0,2).toUpperCase()}</div>}
                    <div className={"bubble " + (isSelf ? "self" : "")}>
                      <div>{msg.content}</div>
                      <div className="bubble-meta">{new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
                    </div>
                  </div>
                );
              })
            )}
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
              placeholder="Type a message…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              ref={inputRef}
              autoFocus
            />
            <button className="chat-send" type="submit" disabled={loading || !to || !content.trim()}>Send</button>
          </form>
        </section>

        {/* Right listing panel */}
        <aside className="chat-right">
          <div className="chat-right-header">Item info</div>
          <div className="listing-panel">
            <div className="listing-card">
              {selectedItem?.imageUrl ? (
                <img src={selectedItem.imageUrl} alt="" className="listing-image" />
              ) : (
                <div className="listing-image" />
              )}
              <div className="listing-meta">
                {selectedItem?.name ? <div className="listing-title">{selectedItem.name}</div> : null}
                {/* Optional: price if loaded elsewhere; keeping clean per request */}
                <div className="panel-actions">
                  {selectedItem?.id ? (
                    <button
                      className="panel-btn primary"
                      onClick={() => nav(`/items/${selectedItem.id}`)}
                    >
                      View item
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ChatPage;
