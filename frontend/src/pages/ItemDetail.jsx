
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ItemDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) return <div className="market-bg"><div className="market-container">Loading…</div></div>;
  if (error) return <div className="market-bg"><div className="market-container">{error}</div></div>;
  if (!item) return null;

  return (
    <div className="market-bg">
      <div className="market-container">
        <button className="market-back" onClick={() => nav(-1)}>&larr; Back</button>
        <div className="market-detail">
          <img src={item.img} alt={item.name} className="market-detail-img" />
          <div className="market-detail-content">
            <h1 className="market-detail-title">{item.name}</h1>
            <p className="market-detail-cat">{item.category}</p>
            <p className="market-detail-price">${item.price.toFixed(2)}</p>
            <p className="market-detail-desc">{item.description}</p>
            <p className="market-detail-meta">Quantity: {item.quantity ?? 'N/A'}</p>
            <p className="market-detail-meta">Purchased: {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : 'N/A'}</p>
            {item.expiration && <p className="market-detail-meta">Expires: {new Date(item.expiration).toLocaleDateString()}</p>}
            <p className="market-detail-user">Posted by: {item.username || "Unknown"}</p>
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
            <button className="market-card-btn" onClick={() => alert("Request sent!")}>Request</button>
          </div>
        </div>
      </div>
    </div>
  );
}
