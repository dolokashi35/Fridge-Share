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
  const [selectedItemId, setSelectedItemId] = useState(null);
  useEffect(() => {
    if (!selectedItemId && grouped.active.length) {
      setSelectedItemId(grouped.active[0]._id);
    }
    if (selectedItemId && !grouped.active.find(i => i._id === selectedItemId)) {
      setSelectedItemId(grouped.active[0]?._id || null);
    }
  }, [grouped.active, selectedItemId]);

  const truncate = (text, len = 90) => {
    if (!text) return "";
    return text.length > len ? `${text.slice(0, len)}…` : text;
  };
  const listedAgo = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const diff = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
    if (diff === 0) return "Listed today";
    if (diff === 1) return "Listed 1 day ago";
    return `Listed ${diff} days ago`;
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

  // Open or create a chat thread tied to item and buyer
  const openOrCreateThread = async (buyerUsername, item, initialMessage) => {
    try {
      const user = JSON.parse(localStorage.getItem('fs_user'));
      const token = user?.token;
      // 1) Check for existing thread with this buyer + item
      const res = await axios.get(`${BACKEND_URL}/api/messages`, {
        params: { peer: buyerUsername, itemId: item._id },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const threadExists = (res.data?.messages || []).length > 0;
      // 2) If not exists, create first message
      if (!threadExists && initialMessage) {
        await axios.post(`${BACKEND_URL}/api/messages`, {
          to: buyerUsername,
          content: initialMessage,
          itemId: item._id,
          itemName: item.name,
          itemImageUrl: item.imageUrl || item.img || ""
        }, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
      }
      // 3) Navigate to chat threaded by item
      nav("/chat", {
        state: {
          to: buyerUsername,
          item: { id: item._id, name: item.name, imageUrl: item.imageUrl || item.img || "" }
        }
      });
    } catch (e) {
      console.error("Open/create chat failed:", e);
      alert("Could not open chat. Please try again.");
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
          <div className="section-card" style={{ marginTop: 8 }}>
            <div className="section-title">Active Listings</div>
            <div className="market-empty" style={{ boxShadow: "none", padding: 0 }}>
              You haven’t posted anything yet.
              <div style={{ marginTop: 12 }}>
                <button className="market-card-btn request" onClick={() => nav("/post")}>
                  Post your first item
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mylist-split" style={{ marginTop: 8 }}>
              {/* Left: listings */}
              <div className="mylist-left">
                <div className="mylist-left-header">Active Listings</div>
                <div className="mylist-list">
                  {grouped.active.map((it) => {
                    const pendCount = (offersByItem[it._id] || []).filter(o => o.status === "pending" || o.status === "countered").length;
                    return (
                    <div
                      key={it._id}
                      className={"mylist-item-row " + (selectedItemId === it._id ? "active" : "")}
                      onClick={() => setSelectedItemId(it._id)}
                    >
                      <img src={it.imageUrl || it.img || "https://images.unsplash.com/photo-1574226516831-e1dff420e12f?auto=format&fit=crop&w=300&q=40"} alt={it.name} />
                      <div className="mylist-item-meta">
                        <div className="title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {it.name}
                          {pendCount > 0 && <span className="count-badge">{pendCount}</span>}
                        </div>
                        <div className="sub">${it.price.toFixed(2)} • Qty {it.quantity ?? 'N/A'}</div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: offers for selected */}
              <div className="mylist-right">
                <div className="mylist-right-header">
                  Offers
                  <span className="count-badge">
                    {(offersByItem[selectedItemId] || []).filter(o => o.status === "pending" || o.status === "countered").length || 0}
                  </span>
                </div>
                <div className="mylist-offers-scroll">
                  {(() => {
                    const list = (offersByItem[selectedItemId] || []).filter(
                      (o) => o.status === "pending" || o.status === "countered"
                    );
                    return selectedItemId && list.length > 0 ? (
                      list.map((o) => (
                      <div key={o._id} className="offer-card">
                        <div className="offer-title-line">
                          {o.itemName || (items.find(x => x._id === selectedItemId)?.name) || 'Item'} • ${o.offerPrice.toFixed(2)}
                        </div>
                        <p className="offer-meta">Offer from <b>{o.buyerUsername}</b></p>
                        {o.message && <p className="offer-meta">“{o.message}”</p>}
                        <div className="offer-actions">
                          <button
                            className="market-card-btn btn-primary"
                            disabled={respondingId === o._id}
                            onClick={async () => {
                              // Optimistically remove offer from list
                              setOffersByItem((prev) => {
                                const next = { ...prev };
                                next[selectedItemId] = (next[selectedItemId] || []).filter(x => x._id !== o._id);
                                return next;
                              });
                              await respond(o._id, "accept");
                              const item = items.find(x => x._id === selectedItemId);
                              if (item) {
                                openOrCreateThread(
                                  o.buyerUsername,
                                  item,
                                  `Hi! I accepted your offer for "${item.name}". When and where would you like to meet?`
                                );
                              }
                            }}
                          >
                            Accept
                          </button>
                          <button
                            className="market-card-btn btn-neutral"
                            disabled={respondingId === o._id}
                            onClick={async () => {
                              // Optimistically remove the offer from the visible list
                              setOffersByItem((prev) => {
                                const next = { ...prev };
                                next[selectedItemId] = (next[selectedItemId] || []).filter(x => x._id !== o._id);
                                return next;
                              });
                              await respond(o._id, "decline");
                            }}
                          >
                            Decline
                          </button>
                          <button
                            className="market-card-btn btn-blue"
                            onClick={() => {
                              const item = items.find(x => x._id === selectedItemId);
                              if (item) {
                                // Optimistically remove offer when moving to chat (negotiation continues in thread)
                                setOffersByItem((prev) => {
                                  const next = { ...prev };
                                  next[selectedItemId] = (next[selectedItemId] || []).filter(x => x._id !== o._id);
                                  return next;
                                });
                                openOrCreateThread(
                                  o.buyerUsername,
                                  item,
                                  `What price did you have in mind for "${item.name}"?`
                                );
                              }
                            }}
                          >
                            Chat
                          </button>
                        </div>
                      </div>
                      ))
                    ) : (
                    <div className="offer-meta">No offers yet for this listing.</div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {grouped.past.length > 0 && (
              <div className="section-card" style={{ marginTop: 24 }}>
                <div className="section-title">Completed / Past</div>
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
              </div>
            )}

            {/* Removed global incoming offers section; offers are shown per selected listing on the right. */}
          </>
        )}
      </div>
    </div>
  );
}
