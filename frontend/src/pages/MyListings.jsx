import { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./marketplace-modern.css";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function MyListings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const nav = useNavigate();

  const fetchMyItems = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchMyItems();
  }, [fetchMyItems]);

  // Refresh when the tab gains focus or becomes visible again
  useEffect(() => {
    const onFocus = () => fetchMyItems();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchMyItems();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchMyItems]);

  const grouped = useMemo(() => {
    const active = [];
    const past = [];
    for (const it of items) {
      if (it.status === "sold" || it.handoffStatus === "completed") {
        past.push(it);
      } else {
        active.push(it);
      }
    }
    return { active, past };
  }, [items]);

  const truncate = (text, len = 90) => {
    if (!text) return "";
    return text.length > len ? `${text.slice(0, len)}…` : text;
  };

  // Seller offers
  const [offersByItem, setOffersByItem] = useState({});
  const [respondingId, setRespondingId] = useState(null);
  const loadOffers = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('fs_user'));
      const token = user?.token;
      const res = await axios.get(`${BACKEND_URL}/api/offers`, {
        params: { role: "seller" },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const map = {};
      (res.data || []).forEach((o) => {
        if (!map[o.itemId]) map[o.itemId] = [];
        map[o.itemId].push(o);
      });
      setOffersByItem(map);
    } catch {
      setOffersByItem({});
    }
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const respond = async (offerId, action, counterPrice) => {
    try {
      setRespondingId(offerId);
      const user = JSON.parse(localStorage.getItem('fs_user'));
      const token = user?.token;
      await axios.post(`${BACKEND_URL}/api/offers/${offerId}/respond`, {
        action, counterPrice
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      await loadOffers();
    } catch {
      alert("Failed to respond to offer");
    } finally {
      setRespondingId(null);
    }
  };

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
        {loading ? (
          <div className="market-empty">Loading…</div>
        ) : items.length === 0 ? (
          <div className="market-empty">
            You haven’t posted anything yet.
            <div style={{ marginTop: 12 }}>
              <button className="market-card-btn request" onClick={() => nav("/post")}>
                Post your first item
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ margin: "8px 4px 12px", fontSize: "1.1rem" }}>Active</h2>
            <div className="market-grid mylist-grid">
              {grouped.active.map(it => (
                <div key={it._id} className="market-card mylist-card hover-animate">
                  <div style={{ position: "relative" }}>
                    <img
                      src={it.imageUrl || it.img || "https://images.unsplash.com/photo-1574226516831-e1dff420e12f?auto=format&fit=crop&w=600&q=60"}
                      alt={it.name}
                      className="market-img"
                    />
                    <span className="category-badge">{it.category}</span>
                  </div>
                  <div className="market-card-content">
                    <h3 className="market-card-title">{it.name}</h3>
                    <p className="market-card-price">${it.price.toFixed(2)}</p>
                    <p className="market-card-meta">{truncate(it.description)}</p>
                    <p className="market-card-meta">Qty: {it.quantity ?? 'N/A'}</p>
                    {it.expiration && <p className="market-card-meta">Expires: {new Date(it.expiration).toLocaleDateString()}</p>}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
              ))}
            </div>

            {grouped.past.length > 0 && (
              <>
                <h2 style={{ margin: "18px 4px 12px", fontSize: "1.1rem" }}>Completed / Past</h2>
                <div className="market-grid mylist-grid">
                  {grouped.past.map(it => (
                    <div key={it._id} className="market-card mylist-card hover-animate" style={{ opacity: 0.9 }}>
                      <div style={{ position: "relative" }}>
                        <img
                          src={it.imageUrl || it.img || "https://images.unsplash.com/photo-1574226516831-e1dff420e12f?auto=format&fit=crop&w=600&q=60"}
                          alt={it.name}
                          className="market-img"
                        />
                        <span className="category-badge">{it.category}</span>
                      </div>
                      <div className="market-card-content">
                        <h3 className="market-card-title">{it.name}</h3>
                        <p className="market-card-price">${it.price.toFixed(2)}</p>
                        <p className="market-card-meta">{truncate(it.description)}</p>
                        <p className="market-card-meta">Status: {it.status || it.handoffStatus || "completed"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pending offers per Active item (basic UI) */}
            {grouped.active.length > 0 && (
              <>
                <h2 style={{ margin: "18px 4px 12px", fontSize: "1.1rem" }}>Incoming Offers</h2>
                <div className="market-grid mylist-grid">
                  {grouped.active.map((it) => {
                    const offers = (offersByItem[it._id] || []).filter(o => o.status === "pending" || o.status === "countered");
                    if (!offers.length) return null;
                    return (
                      <div key={`${it._id}-offers`} className="market-card mylist-card" style={{ paddingBottom: 8 }}>
                        <div className="market-card-content">
                          <h3 className="market-card-title">{it.name} • ${it.price.toFixed(2)}</h3>
                          {offers.map((o) => (
                            <div key={o._id} style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8, marginTop: 8 }}>
                              <p className="market-card-meta">
                                Offer from <b>{o.buyerUsername}</b>: ${o.offerPrice.toFixed(2)} {o.status === "countered" && `(counter: $${(o.counterPrice || 0).toFixed(2)})`}
                              </p>
                              {o.message && <p className="market-card-meta">“{o.message}”</p>}
                              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <button
                                  className="market-card-btn request"
                                  disabled={respondingId === o._id}
                                  onClick={() => respond(o._id, "accept")}
                                >
                                  Accept
                                </button>
                                <button
                                  className="market-card-btn message"
                                  disabled={respondingId === o._id}
                                  onClick={() => respond(o._id, "decline")}
                                >
                                  Decline
                                </button>
                                <button
                                  className="market-card-btn"
                                  style={{ background: "#0ea5e9", color: "#fff" }}
                                  disabled={respondingId === o._id}
                                  onClick={() => {
                                    const cp = prompt("Counter price?");
                                    if (!cp) return;
                                    respond(o._id, "counter", Number(cp));
                                  }}
                                >
                                  Counter
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
