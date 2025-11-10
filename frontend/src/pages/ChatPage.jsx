

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import './chat.css';


const ChatPage = ({ currentUser }) => {
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [to, setTo] = useState(() => (location.state && location.state.to) || '');
  const [content, setContent] = useState(() => (location.state && location.state.prefill) || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const peerInitials = useMemo(() => {
    const name = to || 'User';
    const alpha = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return alpha.slice(0, 2) || 'US';
  }, [to]);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/messages', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(res.data.messages || []);
      } catch (err) {
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, []);

  // Send a message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!to || !content) return;
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      await axios.post(
        '/api/messages',
        { to, content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setContent('');
      // Refresh messages
      const res = await axios.get('/api/messages', {
        headers: { Authorization: `Bearer ${token}` },
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
        <div className="chat-header">
          <div className="chat-peer-avatar">{peerInitials}</div>
          <div className="chat-peer-title">
            <div className="chat-peer-name">{to || 'Conversation'}</div>
            <div className="chat-peer-sub">Secure • Direct message</div>
          </div>
        </div>

        {error && <div className="chat-error">{error}</div>}

        <div className="chat-body">
          {loading && messages.length === 0 ? (
            <div className="offer-meta">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="offer-meta">Say hello and propose a time and place.</div>
          ) : (
            messages.map((msg) => {
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
          />
          <button className="chat-send" type="submit" disabled={loading || !to || !content.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;
