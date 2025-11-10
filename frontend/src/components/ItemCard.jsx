import { useState } from 'react';
import './ItemCard.css';

export default function ItemCard({ item, onStartTransaction }) {
  const [showDetails, setShowDetails] = useState(false);

  const formatDistance = (distance) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m away`;
    }
    return `${distance}km away`;
  };

  const formatExpiration = (expirationDate) => {
    if (!expirationDate) return 'No expiration';
    
    const now = new Date();
    const exp = new Date(expirationDate);
    const diffTime = exp - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    return `Expires in ${diffDays} days`;
  };

  return (
    <div className="item-card">
      <div className="item-card-header">
        <img 
          src={item.imageUrl || item.img} 
          alt={item.name} 
          className="item-card-image"
        />
        <div className="item-card-badge">
          <span className="category-badge">{item.category}</span>
          <span className="distance-badge">{formatDistance(item.distance)}</span>
        </div>
      </div>

      <div className="item-card-content">
        <h3 className="item-card-title">{item.name}</h3>
        <p className="item-card-price">${item.price.toFixed(2)}</p>
        <p className="item-card-seller">Posted by {item.username}</p>
        
        {item.description && (
          <p className="item-card-description">{item.description}</p>
        )}

        <div className="item-card-meta">
          <div className="meta-item">
            <span className="meta-label">Quantity:</span>
            <span className="meta-value">{item.quantity || 'N/A'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Expires:</span>
            <span className="meta-value">{formatExpiration(item.expirationDate)}</span>
          </div>
        </div>

        {showDetails && (
          <div className="item-card-details">
            <div className="detail-item">
              <span className="detail-label">Purchase Date:</span>
              <span className="detail-value">
                {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Transfer Methods:</span>
              <span className="detail-value">
                {item.transferMethods?.join(', ') || 'Pickup'}
              </span>
            </div>
            {item.location?.name && (
              <div className="detail-item">
                <span className="detail-label">Location:</span>
                <span className="detail-value">{item.location.name}</span>
              </div>
            )}
          </div>
        )}

        <div className="item-card-actions">
          <button 
            className="action-btn secondary"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          <button 
            className="action-btn primary"
            onClick={() => onStartTransaction(item)}
          >
            💬 Message Seller
          </button>
        </div>
      </div>
    </div>
  );
}
