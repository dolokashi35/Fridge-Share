import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function MyListings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    async function fetchMyItems() {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('fs_user'));
      const token = user?.token;
      try {
        const res = await axios.get(`${BACKEND_URL}/items`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const myId = user?.username;
        setItems(res.data.filter(it => it.username === myId));
      } catch {
        setItems([]);
      }
      setLoading(false);
    }
    fetchMyItems();
  }, []);

  return (
    <div className="market-bg">
      <div className="market-container">
        <h1 className="market-title">My Listings</h1>
        {loading ? <div>Loading…</div> : (
          <div className="market-grid">
            {items.length ? items.map(it => (
              <div key={it.id} className="market-card">
                <img src={it.img} alt={it.name} className="market-img" />
                <div className="market-card-content">
                  <h3 className="market-card-title">{it.name}</h3>
                  <p className="market-card-cat">{it.category}</p>
                  <p className="market-card-price">${it.price.toFixed(2)}</p>
                  <p className="market-card-meta">Qty: {it.quantity ?? 'N/A'}</p>
                  <p className="market-card-meta">Purchased: {it.purchaseDate ? new Date(it.purchaseDate).toLocaleDateString() : 'N/A'}</p>
                  {it.expiration && <p className="market-card-meta">Expires: {new Date(it.expiration).toLocaleDateString()}</p>}
                  <p className="market-card-desc">{it.description}</p>
                  <button className="market-card-btn" onClick={() => nav(`/edit/${it.id}`)}>Edit</button>
                </div>
              </div>
            )) : <p className="market-empty">No items posted yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
