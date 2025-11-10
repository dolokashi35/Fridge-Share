import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import MeetingLocationPicker from "../components/MeetingLocationPicker";
import "./postitem.css";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const CATEGORIES = [
  "Produce", "Dairy", "Baked Goods", "Meat", "Seafood",
  "Frozen", "Fresh", "Drinks", "Snacks", "Canned", "Spices", "Sauces",
];

export default function PostItem() {
  const navigate = useNavigate();
  const camRef = useRef(null);

  // item states
  const [imageSrc, setImageSrc] = useState(null);
  const [predictedName, setPredictedName] = useState("");
  const [confidence, setConfidence] = useState("");
  const [confirmedName, setConfirmedName] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [detectedText, setDetectedText] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [expiration, setExpiration] = useState("");
  const [quantity, setQuantity] = useState("");
  const [listingDuration, setListingDuration] = useState("3");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  // transfer methods state (Pickup/Dropoff)
  const [transferMethods, setTransferMethods] = useState(["Pickup"]);
  
  // Location states
  const [pickupLocation, setPickupLocation] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (err) => {
          console.error("Error getting user location:", err);
        }
      );
    }
  }, []);

  const captureImage = async () => {
    if (!camRef.current) return;
    const image = camRef.current.getScreenshot();
    setImageSrc(image);
    setAnalyzing(true);

    try {
      const formData = new FormData();
      const blob = await (await fetch(image)).blob();
      formData.append("image", blob, "item.jpg");
      formData.append("quantity", quantity || "1");

      const res = await axios.post(`${BACKEND_URL}/api/analyze`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

            const data = res.data;
            setPredictedName(data.itemName || "Unknown");
            setConfirmedName(data.itemName || "Unknown");
            // Store detected text separately for description generation
            setDetectedText(data.detectedText || "");
            // Use AI-generated description from text analysis
            setDescription(data.description || "");
            setPrice(data.price || "");
            setConfidence(data.confidence || "");
    } catch (err) {
      console.error("❌ AI analyze error:", err);
      alert("AI analysis failed. Please retry.");
    } finally {
      setAnalyzing(false);
    }
  };

  const retakeImage = () => {
    setImageSrc(null);
    setPredictedName("");
    setConfirmedName("");
    setDescription("");
    setDetectedText("");
    setPrice("");
    setConfidence("");
  };

  // Handle pickup location selection
  const handleLocationConfirm = (location) => {
    setPickupLocation(location);
  };

  // toggle transfer method selection
  const toggleTransfer = (method) => {
    setTransferMethods((prev) => {
      if (prev.includes(method)) return prev.filter((m) => m !== method);
      return [...prev, method];
    });
  };

  // ✨ Generate AI Description
  const generateDescription = async () => {
    if (!confirmedName) return alert("Please enter an item name first!");
    try {
      setAiLoading(true);
      const res = await axios.post(`${BACKEND_URL}/api/generate-description`, {
        itemName: confirmedName,
        quantity: quantity || "1",
        category: manualCategory,
        detectedText: detectedText || "" // Pass the detected text from image analysis
      });
      setDescription(res.data.description);
    } catch (err) {
      console.error(err);
      alert("Failed to generate AI description.");
    } finally {
      setAiLoading(false);
    }
  };

  // 💰 Generate Suggested Price
  const generateSuggestedPrice = async () => {
    if (!confirmedName || !quantity) return alert("Enter both item name and quantity!");
    try {
      setAiLoading(true);
      const res = await axios.post(`${BACKEND_URL}/api/suggest-price`, {
        itemName: confirmedName,
        quantity,
      });
      setPrice(res.data.discountedPrice || res.data.price || "");
    } catch (err) {
      console.error(err);
      alert("Failed to generate price suggestion.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmedName || !purchaseDate || !quantity || !pickupLocation) {
      alert("Please fill out all required fields including pickup location.");
      return;
    }
    
    setLoading(true);
    
    try {
      // Get current user info
      const user = JSON.parse(localStorage.getItem('fs_user'));
      if (!user || !user.username) {
        alert("Please log in to post items.");
        navigate("/login");
        return;
      }

      // Prepare item data
      const itemData = {
        name: confirmedName,
        category: manualCategory || "Fresh", // Default category if none selected
        price: parseFloat(price) || 0,
        description: description || "",
        quantity: parseInt(quantity),
        purchaseDate: purchaseDate,
        expirationDate: expiration || null,
        listingDuration: parseInt(listingDuration),
        transferMethods,
        imageUrl: imageSrc || "", // Use captured image if available
        username: user.username,
        location: {
          type: 'Point',
          coordinates: [pickupLocation.coordinates[1], pickupLocation.coordinates[0]], // [lng, lat]
          name: pickupLocation.name
        }
      };

      // Submit to backend
      const response = await axios.post(`${BACKEND_URL}/items`, itemData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        }
      });

      console.log("✅ Item posted successfully:", response.data);
      alert("Item Posted Successfully!");
      navigate("/mylistings");
      
    } catch (error) {
      console.error("❌ Error posting item:", error);
      alert("Failed to post item. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header>
        <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
          <h1>Post a New Item</h1>
          <p>
            Share your surplus food with the community.{" "}
            <i className="far fa-lightbulb" style={{ color: "#f59e0b" }}></i>
          </p>
        </div>
      </header>

      <div className="post-bg">
        <div className="post-layout">
          {/* LEFT COLUMN */}
          <div className="post-left">
            {/* 1️⃣ Basic Info */}
            <section className="post-card">
              <h2>1. Basic Information</h2>
              <div className="post-row">
                <div style={{ flex: "1 1 100%" }}>
                  <label className="post-label">
                    Item Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="post-input"
                    placeholder="e.g., Organic Whole Milk"
                    value={confirmedName}
                    onChange={(e) => setConfirmedName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="post-row">
                <div>
                  <label className="post-label">Category *</label>
                  <select
                    className="post-select"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                  >
                    <option value="">Select...</option>
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="post-label">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Number of units"
                    className="post-input"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
              </div>

              <div className="post-row">
                <div>
                  <label className="post-label">Date Purchased *</label>
                  <input
                    type="date"
                    className="post-input"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="post-label">Best By / Expiration</label>
                  <input
                    type="date"
                    className="post-input"
                    style={{ backgroundColor: "#fffbe6" }}
                    value={expiration}
                    onChange={(e) => setExpiration(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* 2️⃣ Description */}
            <section className="post-card">
              <h2>2. Description</h2>
              <textarea
                className="post-textarea"
                rows="4"
                placeholder="Add details or reason for posting..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>

              <button
                onClick={generateDescription}
                className="scan-btn mt-3"
                style={{ width: "100%" }}
                disabled={aiLoading}
              >
                {aiLoading ? "Loading..." : "✨ Generate AI Description"}
              </button>
            </section>

            {/* 3️⃣ Pricing & Logistics */}
            <section className="post-card">
              <h2>3. Pricing & Logistics</h2>
              <div className="post-row">
                <div>
                  <label className="post-label">Suggested Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g., 2.50"
                    className="post-input"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  <button
                    onClick={generateSuggestedPrice}
                    className="scan-btn mt-2"
                    style={{ width: "100%" }}
                    disabled={aiLoading}
                  >
                    {aiLoading ? "Loading..." : "💰 Generate Suggested Price"}
                  </button>
                </div>

                <div>
                  <label className="post-label">Listing Duration *</label>
                  <select
                    className="post-select"
                    value={listingDuration}
                    onChange={(e) => setListingDuration(e.target.value)}
                  >
                    {[...Array(7)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} {i + 1 === 1 ? "Day" : "Days"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span className="post-label">Transfer Methods *</span>
                <div className="post-checkboxes">
                  {["Pickup", "Dropoff"].map((m) => (
                    <label key={m} className="post-checkbox-label">
                      <input
                        type="checkbox"
                        checked={transferMethods.includes(m)}
                        onChange={() => toggleTransfer(m)}
                      />{" "}
                      {m}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* 4️⃣ Pickup Location */}
            <section className="post-card">
              <h2>4. Pickup Location <span style={{ color: "#ef4444" }}>*</span></h2>
              <div className="post-row">
                <div style={{ flex: "1 1 100%" }}>
                  <label className="post-label">Where can buyers pick up this item?</label>
                  <div className="location-selection">
                    {pickupLocation ? (
                      <div className="selected-location-display">
                        <div className="location-info">
                          <span className="location-icon">📍</span>
                          <div className="location-details">
                            <div className="location-name">{pickupLocation.name}</div>
                            <div className="location-type">{pickupLocation.type}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowLocationPicker(true)}
                          className="change-location-btn"
                        >
                          Change Location
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowLocationPicker(true)}
                        className="select-location-btn"
                      >
                        📍 Select Pickup Location
                      </button>
                    )}
                  </div>
                  <p className="location-help-text">
                    Choose a safe, accessible location where buyers can pick up your item.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="post-right">
            <section className="media-section">
              <h2>Item Media</h2>

              {imageSrc ? (
                <div style={{ textAlign: "center" }}>
                  <img
                    src={imageSrc}
                    alt="Captured"
                    className="post-webcam"
                    style={{ maxWidth: "100%", borderRadius: "1rem" }}
                  />
                  {predictedName && (
                    <p>
                      Prediction: <b>{predictedName}</b>{" "}
                      {confidence && `(${confidence}%)`}
                    </p>
                  )}
                  <button
                    onClick={retakeImage}
                    className="post-btn"
                    style={{
                      background: "#d1d5db",
                      color: "#374151",
                      width: "100%",
                    }}
                  >
                    Retake Photo
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <Webcam
                    ref={camRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "environment" }}
                    className="post-webcam"
                  />
                  <button
                    onClick={captureImage}
                    className="scan-btn"
                    style={{ marginTop: "1rem" }}
                    disabled={analyzing}
                  >
                    {analyzing ? "Analyzing..." : "Scan Item with AI"}
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer>
        <div className="footer-actions">
          <button className="cancel-btn" onClick={() => navigate("/marketplace")}>
            Cancel
          </button>
          <button
            className="post-now-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            <i className="fas fa-paper-plane" style={{ marginRight: "0.5rem" }}></i>
            POST ITEM NOW
          </button>
        </div>
      </footer>

      {/* Overlay */}
      {(loading || analyzing || aiLoading) && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255,255,255,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <p style={{ fontSize: "1.2rem", color: "#2563eb" }}>
            <i className="fas fa-spinner fa-spin" style={{ marginRight: "0.5rem" }}></i>
            {loading ? "Posting..." : "Processing with AI..."}
          </p>
        </div>
      )}

      {/* Meeting Location Picker Modal */}
      <MeetingLocationPicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationConfirm={handleLocationConfirm}
        userLocation={userLocation}
        currentLocation={pickupLocation}
      />
    </div>
  );
}
