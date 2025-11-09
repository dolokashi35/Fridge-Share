import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function MyListings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    async function fetchMyItems() {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('fs_user'));
      const token = user?.token;
      try {
        const res = await axios.get(`${BACKEND_URL}/items/mine`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setItems(res.data || []);
      } catch {
        setItems([]);
      }
      setLoading(false);
    }
    fetchMyItems();
  }, []);

  async function handleDelete(itemId) {
    const user = JSON.parse(localStorage.getItem('fs_user'));
    const token = user?.token;
    if (!token) {
      alert("Please log in to delete a listing.");
      return;
    }
    const confirm = window.confirm("Delete this listing? This cannot be undone.");
    if (!confirm) return;
    try {
      setDeletingId(itemId);
      await axios.delete(`${BACKEND_URL}/items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(prev => prev.filter(it => it._id !== itemId));
    } catch (e) {
      console.error("Failed to delete item", e);
      alert("Failed to delete item.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="market-bg">
      <div className="market-container">
        <h1 className="market-title">My Listings</h1>
        {loading ? <div>Loading…</div> : (
          <div className="market-grid">
            {items.length ? items.map(it => (
              <div key={it._id} className="market-card">
                <img src={it.imageUrl || it.img || "https://images.unsplash.com/photo-1574226516831-e1dff420e12f?auto=format&fit=crop&w=600&q=60"} alt={it.name} className="market-img" />
                <div className="market-card-content">
                  <h3 className="market-card-title">{it.name}</h3>
                  <p className="market-card-cat">{it.category}</p>
                  <p className="market-card-price">${it.price.toFixed(2)}</p>
                  <p className="market-card-meta">Qty: {it.quantity ?? 'N/A'}</p>
                  <p className="market-card-meta">Purchased: {it.purchaseDate ? new Date(it.purchaseDate).toLocaleDateString() : 'N/A'}</p>
                  {it.expiration && <p className="market-card-meta">Expires: {new Date(it.expiration).toLocaleDateString()}</p>}
                  <p className="market-card-desc">{it.description}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="market-card-btn" onClick={() => nav(`/edit/${it._id}`)}>Edit</button>
                    <button
                      className="market-card-btn"
                      style={{ background: "#ef4444" }}
                      disabled={deletingId === it._id}
                      onClick={() => handleDelete(it._id)}
                    >
                      {deletingId === it._id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )) : <p className="market-empty">No items posted yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
