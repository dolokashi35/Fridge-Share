import { useState } from 'react';
import axios from 'axios';
import './handoff.css';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function HandoffModal({ item, isOpen, onClose, onHandoffComplete }) {
  const [handoffTo, setHandoffTo] = useState('');
  const [handoffNotes, setHandoffNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleHandoff = async () => {
    if (!handoffTo.trim()) {
      setError('Please enter recipient username');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${BACKEND_URL}/api/handoff`, {
        itemId: item._id,
        handoffTo: handoffTo.trim(),
        handoffNotes: handoffNotes.trim()
      });

      if (response.data.success) {
        onHandoffComplete(response.data);
        onClose();
        setHandoffTo('');
        setHandoffNotes('');
      }
    } catch (err) {
      console.error('Handoff error:', err);
      setError(err.response?.data?.error || 'Handoff failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="handoff-modal-overlay">
      <div className="handoff-modal">
        <div className="handoff-modal-header">
          <h3>🤝 Handoff Item</h3>
          <button className="handoff-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="handoff-modal-content">
          <div className="handoff-item-info">
            <img src={item.imageUrl} alt={item.name} className="handoff-item-image" />
            <div className="handoff-item-details">
              <h4>{item.name}</h4>
              <p className="handoff-item-price">${item.price.toFixed(2)}</p>
              <p className="handoff-item-category">{item.category}</p>
            </div>
          </div>

          <div className="handoff-form">
            <div className="handoff-form-group">
              <label htmlFor="handoffTo">Recipient Username</label>
              <input
                id="handoffTo"
                type="text"
                value={handoffTo}
                onChange={(e) => setHandoffTo(e.target.value)}
                placeholder="Enter username of person receiving item"
                className="handoff-input"
              />
            </div>

            <div className="handoff-form-group">
              <label htmlFor="handoffNotes">Notes (Optional)</label>
              <textarea
                id="handoffNotes"
                value={handoffNotes}
                onChange={(e) => setHandoffNotes(e.target.value)}
                placeholder="Add any notes about pickup location, time, etc."
                className="handoff-textarea"
                rows="3"
              />
            </div>

            {error && <div className="handoff-error">{error}</div>}

            <div className="handoff-modal-actions">
              <button 
                className="handoff-btn handoff-btn-secondary" 
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="handoff-btn handoff-btn-primary" 
                onClick={handleHandoff}
                disabled={loading || !handoffTo.trim()}
              >
                {loading ? 'Handing Off...' : 'Initiate Handoff'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
