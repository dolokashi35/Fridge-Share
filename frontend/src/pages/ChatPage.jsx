

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import './chat.css';


const ChatPage = ({ currentUser }) => {
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [to, setTo] = useState(() => (location.state && location.state.to) || '');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        <h2 className="chat-title">Messages</h2>
        <form className="chat-form" onSubmit={handleSend}>
          <input
            type="text"
            className="chat-input"
            placeholder="Send to (username)"
            value={to}
            onChange={e => setTo(e.target.value)}
          />
          <input
            type="text"
            className="chat-input"
            placeholder="Message"
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <button className="chat-btn" type="submit" disabled={loading}>Send</button>
        </form>
        {error && <div className="chat-error">{error}</div>}
        <div className="chat-messages">
          {loading ? (
            <div>Loading...</div>
          ) : messages.length === 0 ? (
            <div>No messages yet.</div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={"chat-message " + (msg.from === currentUser ? "chat-message-self" : "chat-message-other") }>
                <div className="chat-message-meta">{msg.from === currentUser ? 'You' : msg.from} ➔ {msg.to === currentUser ? 'You' : msg.to}</div>
                <div className="chat-message-content">{msg.content}</div>
                <div className="chat-message-time">{new Date(msg.timestamp).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
