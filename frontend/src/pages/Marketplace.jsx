import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./marketplace-modern.css"; // Keep styling import

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

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const categories = [
  "All", "Produce", "Dairy", "Baked Goods", "Meat", "Seafood",
  "Frozen", "Fresh", "Drinks", "Snacks", "Canned", "Spices", "Sauces"
];

export default function Marketplace() {
  const [items, setItems] = useState([]);
  const location = useLocation();
  const nav = useNavigate();
  const [term, setTerm] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("name-asc");
  const [minP, setMinP] = useState(0);
  const [maxP, setMaxP] = useState(10);

  useEffect(() => {
    async function fetchItems() {
      try {
        const res = await axios.get(`${BACKEND_URL}/items`);
        setItems(res.data.length ? res.data : SAMPLE);
      } catch {
        setItems(SAMPLE);
      }
    }
    fetchItems();
  }, [location]);

  const filtered = useMemo(() => {
    let list = items.filter((it) => {
      const okCat = cat === "All" || it.category === cat;
      const okTerm = it.name.toLowerCase().includes(term.toLowerCase());
      const okPrice = it.price >= Number(minP) && it.price <= Number(maxP);
      return okCat && okTerm && okPrice;
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
  }, [items, term, cat, sort, minP, maxP]);

  return (
    <div className="market-bg">
      {/* 🧭 Main Marketplace Content (Navbar handled globally in App.jsx) */}
      <div className="market-container">
        <h1 className="market-title">Campus Grocery Marketplace</h1>

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
            className="market-select"
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="market-select"
          >
            <option value="name-asc">Name (A → Z)</option>
            <option value="name-desc">Name (Z → A)</option>
            <option value="price-asc">Price (Low → High)</option>
            <option value="price-desc">Price (High → Low)</option>
          </select>
          <div className="market-range">
            <label>Min</label>
            <input
              type="number"
              value={minP}
              onChange={(e) => setMinP(e.target.value)}
              className="market-input small"
            />
            <label>Max</label>
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
                key={it.id}
                className="market-card"
                onClick={() => nav(`/items/${it.id}`)}
              >
                <img 
                  src={it.imageUrl || it.img || "https://images.unsplash.com/photo-1574226516831-e1dff420e12f?auto=format&fit=crop&w=600&q=60"} 
                  alt={it.name} 
                  className="market-img" 
                />
                <div className="market-card-content">
                  <h3 className="market-card-title">{it.name}</h3>
                  <p className="market-card-cat">{it.category}</p>
                  <p className="market-card-price">
                    ${it.price.toFixed(2)}
                  </p>
                  <p className="market-card-meta">
                    Qty: {it.quantity ?? "N/A"}
                  </p>
                  <p className="market-card-meta">
                    Posted by: <b>{it.username || "Unknown"}</b>
                  </p>
                  <div className="market-card-actions">
                    <button
                      className="market-card-btn request"
                      onClick={(e) => {
                        e.stopPropagation();
                        alert(`Requested to buy: ${it.name}`);
                      }}
                    >
                      Request
                    </button>
                    <button
                      className="market-card-btn message"
                      onClick={(e) => {
                        e.stopPropagation();
                        nav("/chat", { state: { to: it.username } });
                      }}
                    >
                      Message
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
    </div>
  );
}
