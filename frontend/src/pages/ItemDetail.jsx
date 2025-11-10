
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import HandoffModal from '../components/HandoffModal';

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function ItemDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Get current user from localStorage
    const userProfile = localStorage.getItem('userProfile');
    if (userProfile) {
      setCurrentUser(JSON.parse(userProfile));
    }
  }, []);

  useEffect(() => {
    async function fetchItem() {
      setLoading(true);
      try {
        const res = await axios.get(`${BACKEND_URL}/items/${id}`);
        setItem(res.data);
        setError(null);
      } catch (e) {
        setError("Item not found");
        setItem(null);
      }
      setLoading(false);
    }
    fetchItem();
  }, [id]);

  const handleHandoffComplete = (handoffData) => {
    // Update item status locally
    setItem(prev => ({
      ...prev,
      status: 'handed_off',
      handoffStatus: handoffData.handoffStatus,
      handoffTo: handoffData.handoffTo,
      handoffDate: handoffData.handoffDate
    }));
    alert('Handoff initiated successfully!');
  };

  const handleCompleteHandoff = async () => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/complete-handoff`, {
        itemId: item._id
      });
      
      if (response.data.success) {
        setItem(prev => ({
          ...prev,
          status: 'sold',
          handoffStatus: 'completed'
        }));
        alert('Handoff completed successfully!');
      }
    } catch (err) {
      console.error('Complete handoff error:', err);
      alert('Failed to complete handoff');
    }
  };

  const handleCancelHandoff = async () => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/cancel-handoff`, {
        itemId: item._id
      });
      
      if (response.data.success) {
        setItem(prev => ({
          ...prev,
          status: 'active',
          handoffStatus: null,
          handoffTo: null,
          handoffNotes: '',
          handoffDate: null
        }));
        alert('Handoff cancelled successfully!');
      }
    } catch (err) {
      console.error('Cancel handoff error:', err);
      alert('Failed to cancel handoff');
    }
  };

  const getHandoffStatusBadge = () => {
    if (!item.handoffStatus) return null;
    
    const statusClasses = {
      pending: 'handoff-status-pending',
      completed: 'handoff-status-completed',
      cancelled: 'handoff-status-cancelled'
    };

    return (
      <div className={`handoff-status-badge ${statusClasses[item.handoffStatus]}`}>
        {item.handoffStatus === 'pending' && '⏳ Pending'}
        {item.handoffStatus === 'completed' && '✅ Completed'}
        {item.handoffStatus === 'cancelled' && '❌ Cancelled'}
      </div>
    );
  };

  const getHandoffActions = () => {
    if (!item.handoffStatus) return null;

    if (item.handoffStatus === 'pending') {
      return (
        <div className="handoff-actions">
          <button 
            className="handoff-action-btn handoff-action-btn-complete"
            onClick={handleCompleteHandoff}
          >
            ✅ Complete Handoff
          </button>
          <button 
            className="handoff-action-btn handoff-action-btn-cancel"
            onClick={handleCancelHandoff}
          >
            ❌ Cancel Handoff
          </button>
        </div>
      );
    }

    return null;
  };

  if (loading) return <div className="market-bg"><div className="market-container">Loading…</div></div>;
  if (error) return <div className="market-bg"><div className="market-container">{error}</div></div>;
  if (!item) return null;

  const isOwner = currentUser && currentUser.username === item.username;
  const isRecipient = currentUser && currentUser.username === item.handoffTo;

  return (
    <div className="market-bg">
      <div className="market-container">
        <button className="market-back" onClick={() => nav(-1)}>&larr; Back</button>
        <div className="market-detail">
          <img src={item.imageUrl || item.img} alt={item.name} className="market-detail-img" />
          <div className="market-detail-content">
            <h1 className="market-detail-title">{item.name}</h1>
            <p className="market-detail-cat">{item.category}</p>
            <p className="market-detail-price">${item.price.toFixed(2)}</p>
            <p className="market-detail-desc">{item.description}</p>
            <p className="market-detail-meta">Quantity: {item.quantity ?? 'N/A'}</p>
            <p className="market-detail-meta">Purchased: {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : 'N/A'}</p>
            {item.expirationDate && <p className="market-detail-meta">Expires: {new Date(item.expirationDate).toLocaleDateString()}</p>}
            <p className="market-detail-user">Posted by: {item.username || "Unknown"}</p>
            
            {/* Handoff Status */}
            {getHandoffStatusBadge()}
            
            {/* Handoff Info */}
            {item.handoffStatus && (
              <div className="handoff-info">
                {item.handoffStatus === 'pending' && (
                  <p className="handoff-info-text">
                    🤝 Handing off to: <strong>{item.handoffTo}</strong>
                    {item.handoffNotes && <><br />Notes: {item.handoffNotes}</>}
                  </p>
                )}
                {item.handoffStatus === 'completed' && (
                  <p className="handoff-info-text">
                    ✅ Successfully handed off to: <strong>{item.handoffTo}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Handoff Actions */}
            {getHandoffActions()}

            {/* Map integration: show location if available */}
            {item.location && item.location.lat && item.location.lng && (
              <div style={{ margin: '1.5rem 0' }}>
                <h3>Pickup Location</h3>
                <MapContainer center={[item.location.lat, item.location.lng]} zoom={15} style={{ height: 220, width: '100%', borderRadius: 12 }} scrollWheelZoom={false}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[item.location.lat, item.location.lng]}>
                    <Popup>Pickup here</Popup>
                  </Marker>
                </MapContainer>
              </div>
            )}

            {/* Action Buttons */}
            <div className="item-detail-actions">
              {isOwner && item.status === 'active' && (
                <button 
                  className="market-card-btn handoff-btn-primary" 
                  onClick={() => setShowHandoffModal(true)}
                >
                  🤝 Handoff Item
                </button>
              )}
              
              {!isOwner && item.status === 'active' && (
                <button className="market-card-btn" onClick={() => alert("Request sent!")}>
                  Request
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Handoff Modal */}
      <HandoffModal
        item={item}
        isOpen={showHandoffModal}
        onClose={() => setShowHandoffModal(false)}
        onHandoffComplete={handleHandoffComplete}
      />
    </div>
  );
}
