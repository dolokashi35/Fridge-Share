import { useNavigate } from "react-router-dom";

import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import BottomNav from "../components/BottomNav";
import LocationPicker from "../components/LocationPicker";
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import axios from "axios";
import "./postitem.css";
import "./postitem.css";


const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CATEGORIES = [
  "Produce","Dairy","Baked Goods","Meat","Seafood","Frozen","Fresh","Drinks","Snacks","Canned","Spices","Sauces"
];

export default function PostItem() {
  const navigate = useNavigate();
  const [purchaseDateError, setPurchaseDateError] = useState("");
  const [imageError, setImageError] = useState("");
  const [location, setLocation] = useState(null);
  async function handleSubmit(e) {
    e.preventDefault();
    let hasError = false;
    if (!confirmedName.trim() || !quantity.trim() || !price || !description || !imageSrc || !purchaseDate) {
      if (!quantity.trim()) setQuantityError('Please enter quantity');
      if (!imageSrc) {
        setImageError('Please take a picture of the item');
        hasError = true;
      } else {
        setImageError("");
      }
      if (!purchaseDate) {
        setPurchaseDateError('Please enter a purchase date');
        hasError = true;
      } else {
        setPurchaseDateError("");
      }
      if (!imageSrc || !purchaseDate || !quantity.trim()) return;
    }
    setLoading(true);
    try {
      const itemData = {
        name: confirmedName,
        category: manualCategory,
        price: parseFloat(price),
        description,
        quantity: parseInt(quantity),
        purchaseDate,
        expiration,
        listingDuration,
        transferMethods,
        img: imageSrc || '',
        location: location || undefined,
      };
      // Get token from localStorage
      const user = JSON.parse(localStorage.getItem('fs_user'));
      const token = user?.token;
      await axios.post(`${BACKEND_URL}/items`, itemData, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      navigate('/marketplace');
    } catch (err) {
      alert('Failed to post item.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  const [quantityError, setQuantityError] = useState("");
  // Regenerate description and price using backend, based on confirmed item name
  async function regenerateDescription() {
    if (!confirmedName) {
      alert('Please confirm the item name first.');
      return;
    }
    if (!quantity.trim()) {
      setQuantityError('Please enter quantity');
      return;
    } else {
      setQuantityError("");
    }
    setLoading(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/recognize`,
        { itemName: confirmedName, quantity: parseFloat(quantity) || 1 },
        { headers: { 'Content-Type': 'application/json' } }
      );
      setDescription(response.data.description || '');
      setPrice(response.data.price ? response.data.price.replace('$','') : '');
    } catch (err) {
      alert('Failed to generate description.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  // Capture image from webcam
  async function captureImage() {
    if (camRef.current && model) {
      const image = camRef.current.getScreenshot();
      setImageSrc(image);
      // Run classifier on the image
      const img = new window.Image();
      img.src = image;
      img.onload = async () => {
        const predictions = await model.classify(img);
        if (predictions && predictions.length > 0) {
          setPredictedName(predictions[0].className);
          setConfirmedName(predictions[0].className);
        }
      };
    }
  }

  // Retake image
  function retakeImage() {
    setImageSrc(null);
    setPredictedName("");
    setConfirmedName("");
  }
  const camRef = useRef(null);
  const [model, setModel] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);

  // Names
  const [predictedName, setPredictedName] = useState("");
  const [confirmedName, setConfirmedName] = useState("");

  // Details
  const [manualCategory, setManualCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [expiration, setExpiration] = useState("");
  const [quantity, setQuantity] = useState("");
  const [listingDuration, setListingDuration] = useState("1");
  const [transferMethods, setTransferMethods] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const m = await mobilenet.load();
      setModel(m);
    })();
  }, []);

  // You will need to define captureImage, retakeImage, confirmItem, regenerateDescription, handleSubmit, and toggleTransfer if not already present.
  return (
    <div>
      <BottomNav />
      <div className="post-bg">
        <div className="post-container">
          <h2 className="post-title">Post a Grocery Item</h2>
          {/* Form and Image Side by Side */}
          <div className="post-form-row">
            <div className="post-form-col form">
              <form className="post-form" onSubmit={handleSubmit}>
                <div>
                  <label className="post-label">Item Name</label>
                  <input
                    value={confirmedName}
                    onChange={(e) => setConfirmedName(e.target.value)}
                    className="post-input"
                    placeholder="Edit or confirm item name"
                    required
                  />
                  <button
                    type="button"
                    onClick={typeof confirmItem === 'function' ? confirmItem : () => {}}
                    disabled={!confirmedName.trim() || loading}
                    className="post-btn"
                    style={{ marginTop: 8, background: (!confirmedName.trim() || loading) ? '#e5e7eb' : undefined, color: (!confirmedName.trim() || loading) ? '#a1a1aa' : undefined, cursor: (!confirmedName.trim() || loading) ? 'not-allowed' : undefined }}
                  >
                    {loading ? "Confirming..." : "Confirm Item"}
                  </button>
                </div>
                <div>
                  <label className="post-label">Category</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
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
                    onChange={e => { setQuantity(e.target.value); setQuantityError(""); }}
                    className="post-input"
                  >
                    <option value="" disabled hidden style={{ color: '#a1a1aa' }}>Number of products</option>
                    {[...Array(20)].map((_, i) => (
                      <option key={i+1} value={i+1}>{i+1}</option>
                    ))}
                  </select>
                  {quantityError && (
                    <div style={{ color: 'red', fontSize: '0.85rem', marginTop: 2 }}>{quantityError}</div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="post-label">Purchased</label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => { setPurchaseDate(e.target.value); setPurchaseDateError(""); }}
                      className="post-input"
                    />
                    {purchaseDateError && (
                      <div style={{ color: 'red', fontSize: '0.85rem', marginTop: 2 }}>{purchaseDateError}</div>
                    )}
                  </div>
                  <div>
                    <label className="post-label">Expiration (optional)</label>
                    <input
                      type="date"
                      value={expiration}
                      onChange={(e) => setExpiration(e.target.value)}
                      className="post-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="post-label">Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="post-textarea"
                  />
                  <button
                    type="button"
                    onClick={regenerateDescription}
                    className="post-btn"
                    style={{ background: '#f59e42', marginTop: 8, opacity: (!confirmedName.trim()) ? 0.5 : 1, cursor: (!confirmedName.trim()) ? 'not-allowed' : 'pointer' }}
                    disabled={!confirmedName.trim() || loading}
                  >
                    {description ? 'Regenerate Description with AI' : 'Generate AI Description'}
                  </button>
                </div>
                <div>
                  <label className="post-label">Suggested Price ($)</label>
                  {price && (
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 4 }}>Suggested: ${price}</div>
                  )}
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    className="post-input"
                  />
                </div>
                <div>
                  <label className="post-label">Listing Duration</label>
                  <select
                    value={listingDuration}
                    onChange={(e) => setListingDuration(e.target.value)}
                    className="post-select"
                  >
                    <option value="1">1 Day</option>
                    <option value="3">3 Days</option>
                    <option value="7">7 Days</option>
                    <option value="14">14 Days</option>
                  </select>
                </div>
                <div>
                  <label className="post-label">Transfer Methods</label>
                  <div className="post-checkboxes">
                    {['Pickup', 'Dropoff'].map((m) => (
                      <label key={m} className="post-checkbox-label">
                        <input
                          type="checkbox"
                          checked={transferMethods.includes(m)}
                          onChange={() => typeof toggleTransfer === 'function' ? toggleTransfer(m) : null}
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="post-label">Pickup Location (optional)</label>
                  <LocationPicker value={location} onChange={setLocation} />
                </div>
                <button
                  type="submit"
                  className="post-submit-btn"
                  disabled={loading}
                >
                  Post Item
                </button>
              </form>
            </div>
            <div className="post-form-col image">
              {imageSrc ? (
                <>
                  <img src={imageSrc} alt="Captured" className="post-webcam" />
                  <button onClick={retakeImage} className="post-btn" style={{ background: '#e5e7eb', color: '#0f172a' }}>Retake</button>
                </>
              ) : (
                <div className="post-webcam">
                  <Webcam
                    audio={false}
                    ref={camRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "environment" }}
                    style={{ width: '100%' }}
                  />
                  <button
                    onClick={captureImage}
                    className="post-btn"
                    disabled={!model}
                    title={!model ? "Loading model..." : "Scan item"}
                  >
                    {model ? "Scan Item" : "Loading Model…"}
                  </button>
                  {predictedName && (
                    <div className="post-prediction">Prediction: {predictedName}</div>
                  )}
                </div>
              )}
              {imageError && (
                <div style={{ color: 'red', fontSize: '0.85rem', marginTop: 2 }}>{imageError}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
