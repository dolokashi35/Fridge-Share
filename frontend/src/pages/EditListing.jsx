
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./postitem.css";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CATEGORIES = ["Produce","Dairy","Baked","Meat","Seafood","Frozen","Fresh","Drinks","Snacks","Canned","Spices","Sauces"];

export default function EditListing() {
  const { id } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [expiration, setExpiration] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    async function fetchItem() {
      setLoading(true);
      try {
        const res = await axios.get(`${BACKEND_URL}/items/${id}`);
        const it = res.data;
        setName(it.name || "");
        setCategory(it.category || "");
        setPrice(it.price || "");
        setQuantity(it.quantity || "");
        setPurchaseDate(it.purchaseDate || "");
        setExpiration(it.expiration || "");
        setDescription(it.description || "");
        setError(null);
      } catch (e) {
        setError("Item not found");
      }
      setLoading(false);
    }
    fetchItem();
  }, [id]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('fs_user'));
      const token = user?.token;
      await axios.put(`${BACKEND_URL}/items/${id}`,
        { name, category, price, quantity, purchaseDate, expiration, description },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      nav("/mylistings");
    } catch (err) {
      alert("Failed to update item.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="market-bg"><div className="market-container">Loading…</div></div>;
  if (error) return <div className="market-bg"><div className="market-container">{error}</div></div>;

  return (
    <div className="market-bg">
      <div className="market-container">
        <h1 className="market-title">Edit Listing</h1>
        <form className="post-form" onSubmit={handleSave}>
          <div>
            <label className="post-label">Item Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="post-input"
              required
            />
          </div>
          <div>
            <label className="post-label">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="post-select"
            >
              <option value="">Select</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="post-label">Quantity</label>
            <select
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="post-input"
            >
              <option value="" disabled hidden style={{ color: '#a1a1aa' }}>Number of products</option>
              {[...Array(20)].map((_, i) => (
                <option key={i+1} value={i+1}>{i+1}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="post-label">Purchased</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="post-input"
              />
            </div>
            <div>
              <label className="post-label">Expiration (optional)</label>
              <input
                type="date"
                value={expiration}
                onChange={e => setExpiration(e.target.value)}
                className="post-input"
              />
            </div>
          </div>
          <div>
            <label className="post-label">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="post-textarea"
            />
          </div>
          <div>
            <label className="post-label">Price ($)</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
              required
              className="post-input"
            />
          </div>
          <button className="post-submit-btn" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
        </form>
      </div>
    </div>
  );
}
