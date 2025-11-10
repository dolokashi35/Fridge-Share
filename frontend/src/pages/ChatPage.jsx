

import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import './chat.css';
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';


const ChatPage = ({ currentUser }) => {
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [to, setTo] = useState(() => (location.state && location.state.to) || '');
  const [content, setContent] = useState(() => (location.state && location.state.prefill) || '');
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
      const prev = map.get(peer);
      if (!prev || new Date(m.timestamp) > new Date(prev.timestamp)) {
        map.set(peer, {
          peer,
          preview: m.content,
          timestamp: m.timestamp
        });
      }
    }
    // If navigated with a peer but no messages yet, show it
    if (to && !map.has(to)) {
      map.set(to, { peer: to, preview: 'New conversation', timestamp: new Date().toISOString() });
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [messages, currentUser, to]);
  const filteredMessages = useMemo(() => {
    if (!to) return [];
    return messages.filter(m => (m.from === currentUser && m.to === to) || (m.to === currentUser && m.from === to));
  }, [messages, currentUser, to]);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const stored = localStorage.getItem('fs_user');
        const token = stored ? JSON.parse(stored)?.token : null;
        const params = to ? { peer: to } : {};
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
  }, [to]);

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
        { to, content },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setContent('');
      // Refresh messages
      const res = await axios.get(`${BACKEND_URL}/api/messages`, {
        params: { peer: to },
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
                  key={c.peer}
                  className={"chat-list-item " + (to === c.peer ? "active" : "")}
                  onClick={() => {
                    setTo(c.peer);
                    setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
                  }}
                >
                  <div className="chat-peer-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                    {(c.peer || 'U').slice(0,2).toUpperCase()}
                  </div>
                  <div className="meta">
                    <div className="name">{c.peer}</div>
                    <div className="preview">{c.preview}</div>
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
              <div className="chat-peer-sub">Secure • Direct message</div>
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
      </div>
    </div>
  );
};

export default ChatPage;
