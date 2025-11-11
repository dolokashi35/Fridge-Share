import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./marketplace-modern.css"; // Keep styling import
import RequestModal from "../components/RequestModal";

// Haversine distance in kilometers
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const SAMPLE = [
  { id: 1, name: "Bananas", category: "Produce", price: 1.29, img: "https://images.unsplash.com/photo-1574226516831-e1dff420e12f?auto=format&fit=crop&w=600&q=60" },
  { id: 2, name: "Carrots", category: "Produce", price: 0.99, img: "https://images.unsplash.com/photo-1506806732259-39c2d0268443?auto=format&fit=crop&w=600&q=60" },
  { id: 3, name: "Chicken Breast", category: "Meat", price: 5.49, img: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=600&q=60" },
  { id: 4, name: "Potato Chips", category: "Snacks", price: 2.5, img: "https://images.unsplash.com/photo-1590080877777-9b0d95f3a06a?auto=format&fit=crop&w=600&q=60" },
  { id: 5, name: "Apples", category: "Produce", price: 1.99, img: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=600&q=60" },
  { id: 6, name: "Broccoli", category: "Produce", price: 1.75, img: "https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=600&q=60" },
  { id: 7, name: "Beef Steak", category: "Meat", price: 7.99, img: "https://images.unsplash.com/photo-1604908177527-450bb8c9697a?auto=format&fit=crop&w=600&q=60" },
  { id: 8, name: "Chocolate Bar", category: "Snacks", price: 1.5, img: "https://images.unsplash.com/photo-1560963685-7d8a4e5728b8?auto=format&fit=crop&w=600&q=60" },
];

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const categories = [
  "All", "Produce", "Dairy", "Baked", "Meat", "Seafood",
  "Frozen", "Fresh", "Drinks", "Snacks", "Canned", "Spices", "Sauces"
];

export default function Marketplace() {
  const [items, setItems] = useState([]);
  const [modalItem, setModalItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null); // full item details for modal
  const [loadingItem, setLoadingItem] = useState(false);
  const [requests, setRequests] = useState(() => ({})); // itemId -> { offerId, status }
  const [modalSellerStats, setModalSellerStats] = useState(null); // stats for seller in modal
  const location = useLocation();
  const nav = useNavigate();
  const [term, setTerm] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("name-asc");
  const [maxDistanceMi, setMaxDistanceMi] = useState(5); // replaced min price with distance (miles)
  const [maxP, setMaxP] = useState(100);
  const [userLoc, setUserLoc] = useState(null);

  useEffect(() => {
    async function fetchItems() {
      const stored = localStorage.getItem("fs_user");
      const token = stored ? JSON.parse(stored)?.token : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Load existing buyer requests so "Requested"/"Cancel Request" persists on reload
      try {
        if (token) {
          const offerRes = await axios.get(`${BACKEND_URL}/api/offers`, {
            params: { role: "buyer" },
            headers
          });
          const map = {};
          (offerRes.data || []).forEach((o) => {
            if (o && (o.status === "pending" || o.status === "countered") && o.itemId) {
              map[o.itemId] = { offerId: o._id, status: o.status };
            }
          });
          setRequests(map);
        }
      } catch {
        // ignore
      }

      const fetchNearby = async (lat, lng) => {
        try {
          const res = await axios.get(`${BACKEND_URL}/api/items/nearby`, {
            params: { lat, lng, radius: 5000 },
            headers
          });
          setItems(res.data.length ? res.data : SAMPLE);
        } catch {
          // Fallback to scoped items without distance
          try {
            const res = await axios.get(`${BACKEND_URL}/items`, { headers });
            setItems(res.data.length ? res.data : SAMPLE);
          } catch {
            setItems(SAMPLE);
          }
        }
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setUserLoc([latitude, longitude]);
            fetchNearby(latitude, longitude);
          },
          () => {
            // Default center if denied
            fetchNearby(40.7128, -74.0060);
          }
        );
      } else {
        fetchNearby(40.7128, -74.0060);
      }
    }
    fetchItems();
  }, [location]);

  const getHandoffStatusBadge = (item) => {
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

  const filtered = useMemo(() => {
    let list = items.filter((it) => {
      const okCat = cat === "All" || it.category === cat;
      const okTerm = it.name.toLowerCase().includes(term.toLowerCase());
      const okPrice = it.price <= Number(maxP);
      const okDistance =
        typeof it.distance !== "number"
          ? true // if no distance available (fallback list), don't filter it out
          : (it.distance * 0.621371) <= Number(maxDistanceMi || 0);
      return okCat && okTerm && okPrice && okDistance;
    });

    list.sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        default:
          return 0;
      }
    });
    return list;
  }, [items, term, cat, sort, maxDistanceMi, maxP]);

  // Handle item click - fetch full details and show modal
  const handleItemClick = async (itemId) => {
    try {
      setLoadingItem(true);
      const stored = localStorage.getItem("fs_user");
      const token = stored ? JSON.parse(stored)?.token : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.get(`${BACKEND_URL}/items/${itemId}`, { headers });
      const data = res.data || {};
      // If user location and item coordinates are available, compute distance client-side
      if (userLoc && data?.location?.coordinates && data.location.coordinates.length === 2) {
        const [lng, lat] = data.location.coordinates; // stored as [lng, lat]
        const km = calculateDistanceKm(userLoc[0], userLoc[1], lat, lng);
        data.distance = Math.round(km * 100) / 100; // store km to match backend nearby
      }
      setSelectedItem(data);
      
      // Fetch seller stats for the modal
      if (res.data.username) {
        try {
          const statsRes = await axios.get(`${BACKEND_URL}/users/stats/${res.data.username}`);
          setModalSellerStats(statsRes.data);
        } catch {
          setModalSellerStats({ averageRating: 0, purchaseCount: 0 });
        }
      }
    } catch (err) {
      console.error("Failed to load item details:", err);
      alert("Failed to load item details");
    } finally {
      setLoadingItem(false);
    }
  };

  // Close modal when clicking outside
  const handleModalClose = (e) => {
    if (e.target === e.currentTarget) {
      setSelectedItem(null);
      setModalSellerStats(null);
    }
  };

  return (
    <div className="market-bg">
      {/* 🧭 Main Marketplace Content (Navbar handled globally in App.jsx) */}
      <div className="market-container">
        <div className="market-header">
          <h1 className="market-title">Campus Grocery Marketplace</h1>
          <p className="market-subtitle">Find and share groceries with your campus community</p>
        </div>

        {/* Filters */}
        <div className="market-filters">
          <input
            type="search"
            placeholder="Search..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="market-input"
          />
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className={`market-select ${cat !== "All" ? "active" : ""}`}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div className="market-range">
            <label>Distance (mi)</label>
            <input
              type="number"
              value={maxDistanceMi}
              onChange={(e) => setMaxDistanceMi(e.target.value)}
              className="market-input small"
            />
            <label>Max Price</label>
            <input
              type="number"
              value={maxP}
              onChange={(e) => setMaxP(e.target.value)}
              className="market-input small"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="market-grid">
          {filtered.length ? (
            filtered.map((it) => (
              <div
                key={it._id}
                className="market-card"
                onClick={() => handleItemClick(it._id)}
              >
                <img 
                  src={it.imageUrl || it.img || "https://images.unsplash.com/photo-1574226516831-e1dff420e12f?auto=format&fit=crop&w=600&q=60"} 
                  alt={it.name} 
                  className="market-img" 
                />
                <div className="market-card-content">
                  <h3 className="market-card-title">{it.name}</h3>
                  <div className="market-card-info-line">
                    {it.category && (
                      <>
                        <span className="market-card-meta">{it.category}</span>
                        <span className="market-card-separator">•</span>
                      </>
                    )}
                    <span className="market-card-price">${it.price.toFixed(2)}</span>
                    <span className="market-card-separator">•</span>
                    <span className="market-card-meta">Qty: {it.quantity ?? "N/A"}</span>
                    {typeof it.distance === "number" && (
                      <>
                        <span className="market-card-separator">•</span>
                        <span className="market-card-meta">{(it.distance * 0.621371).toFixed(1)} mi</span>
                      </>
                    )}
                  </div>
                  {it.description && (
                    <p className="market-card-description">
                      {it.description}
                    </p>
                  )}
                  <div className="market-request-slot">
                    {requests[it._id] && (requests[it._id].status === "pending" || requests[it._id].status === "countered") ? (
                      <span className="market-card-meta market-requested-text">Requested · Waiting for seller</span>
                    ) : null}
                  </div>
                  <p className="market-card-meta" style={{ marginTop: "0.25rem" }}>
                    Posted by: <b>{it.username || "Unknown"}</b>
                  </p>
                  {it.createdAt && (
                    <p className="market-card-meta" style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.1rem" }}>
                      {new Date(it.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  {/* Handoff Status Badge */}
                  {getHandoffStatusBadge(it)}
                  
                  <div className="market-card-actions" onClick={(e) => e.stopPropagation()}>
                <button
                      className="market-card-btn request"
                      onClick={(e) => {
                        e.stopPropagation();
                    // Start chat to negotiate time/price/location for Buy
                    nav("/chat", {
                      state: {
                        to: it.username,
                        prefill: `Hi! I'd like to buy "${it.name}" at $${it.price.toFixed(2)}. When and where can we meet?`,
                        source: "buy",
                        item: {
                          id: it._id,
                          name: it.name,
                          imageUrl: it.imageUrl || it.img || ""
                        }
                      }
                    });
                      }}
                    >
                  Buy Now
                    </button>
                    <button
                      className="market-card-btn message"
                      onClick={(e) => {
                        e.stopPropagation();
                    const r = requests[it._id];
                    if (r && (r.status === "pending" || r.status === "countered")) {
                      // cancel request
                      const stored = localStorage.getItem("fs_user");
                      const token = stored ? JSON.parse(stored)?.token : null;
                      axios.post(
                        `${BACKEND_URL}/api/offers/${r.offerId}/cancel`,
                        {},
                        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
                      ).then(() => {
                        setRequests((prev) => {
                          const next = { ...prev };
                          next[it._id] = { ...next[it._id], status: "cancelled" };
                          return next;
                        });
                      }).catch(() => {
                        alert("Failed to cancel request");
                      });
                    } else {
                      setModalItem(it);
                    }
                      }}
                    >
                  {requests[it._id] && (requests[it._id].status === "pending" || requests[it._id].status === "countered")
                    ? "Cancel Request"
                    : "Request Item"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="market-empty">No items found.</p>
          )}
        </div>
      </div>
      <RequestModal
        item={modalItem}
        isOpen={!!modalItem}
        onClose={() => setModalItem(null)}
        onRequested={(payload) => {
          const offer = payload?.offer;
          const note = payload?.note;
          if (modalItem?._id && offer?._id) {
            setRequests((prev) => ({
              ...prev,
              [modalItem._id]: { offerId: offer._id, status: offer.status || "pending" }
            }));
          } else if (modalItem?._id) {
            setRequests((prev) => ({
              ...prev,
              [modalItem._id]: { offerId: null, status: "pending" }
            }));
          }
          // Do not auto-open chat here; chat prefill only for Buy flow
        }}
      />

      {/* Item Detail Modal */}
      {selectedItem && (
        <div 
          className="item-modal-overlay" 
          onClick={handleModalClose}
        >
          <div className="item-modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="item-modal-close"
              onClick={() => setSelectedItem(null)}
            >
              ×
            </button>
            {loadingItem ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>
            ) : (
              <>
                <img 
                  src={selectedItem.imageUrl || selectedItem.img || "https://images.unsplash.com/photo-1574226516831-e1dff420e12f?auto=format&fit=crop&w=600&q=60"} 
                  alt={selectedItem.name} 
                  className="item-modal-image"
                />
                <div className="item-modal-body">
                  <h2 className="item-modal-title">{selectedItem.name}</h2>
                  <p className="item-modal-category">{selectedItem.category}</p>
                  <p className="item-modal-price">${selectedItem.price.toFixed(2)}</p>
                  {selectedItem.description && (
                    <p className="item-modal-description">{selectedItem.description}</p>
                  )}
                  <div className="item-modal-meta">
                    <p><strong>Quantity:</strong> {selectedItem.quantity ?? 'N/A'}</p>
                    {selectedItem.purchaseDate && (
                      <p><strong>Purchased:</strong> {new Date(selectedItem.purchaseDate).toLocaleDateString()}</p>
                    )}
                    {selectedItem.expirationDate && (
                      <p><strong>Expires:</strong> {new Date(selectedItem.expirationDate).toLocaleDateString()}</p>
                    )}
                    <p><strong>Posted by:</strong> {selectedItem.username || "Unknown"}</p>
                    {selectedItem.createdAt && (
                      <p><strong>Posted:</strong> {new Date(selectedItem.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    )}
                    {typeof selectedItem.distance === "number" && (
                      <p><strong>Distance:</strong> {(selectedItem.distance * 0.621371).toFixed(1)} mi away</p>
                    )}
                    {selectedItem.location?.name && (
                      <p><strong>Location:</strong> 📍 {selectedItem.location.name}</p>
                    )}
                  </div>
                  
                  {/* Seller Profile Card in Modal */}
                  {selectedItem.username && modalSellerStats && (
                    <div className="seller-profile-card" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                      <div className="seller-profile-header">
                        <div className="seller-avatar">
                          {(selectedItem.username || 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="seller-info">
                          <div className="seller-username">{selectedItem.username}</div>
                          <div className="seller-stats-row">
                            <div className="seller-rating">
                              <span className="seller-stars">
                                {Array.from({ length: 5 }, (_, i) => {
                                  const rating = modalSellerStats.averageRating || 0;
                                  const filled = i < Math.floor(rating);
                                  const half = i === Math.floor(rating) && rating % 1 >= 0.5;
                                  return (
                                    <span key={i} className={filled ? 'star-filled' : half ? 'star-half' : 'star-empty'}>
                                      ★
                                    </span>
                                  );
                                })}
                              </span>
                              <span className="seller-rating-text">
                                {modalSellerStats.averageRating > 0 
                                  ? modalSellerStats.averageRating.toFixed(1) 
                                  : '—'}
                              </span>
                            </div>
                            <div className="seller-purchases">
                              {modalSellerStats.purchaseCount || 0} {modalSellerStats.purchaseCount === 1 ? 'sale' : 'sales'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="item-modal-actions">
                    <button
                      className="item-modal-btn-buy"
                      onClick={() => {
                        setSelectedItem(null);
                        nav("/chat", {
                          state: {
                            to: selectedItem.username,
                            prefill: `Hi! I'd like to buy "${selectedItem.name}" at $${selectedItem.price.toFixed(2)}. When and where can we meet?`,
                            source: "buy",
                            item: {
                              id: selectedItem._id,
                              name: selectedItem.name,
                              imageUrl: selectedItem.imageUrl || selectedItem.img || ""
                            }
                          }
                        });
                      }}
                    >
                      Buy Now
                    </button>
                    <button
                      className="item-modal-btn-request"
                      onClick={() => {
                        setSelectedItem(null);
                        setModalItem(selectedItem);
                      }}
                    >
                      Request Item
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
