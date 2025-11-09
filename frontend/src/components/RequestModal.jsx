import { useMemo, useState } from "react";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function RequestModal({ item, isOpen, onClose, onRequested }) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const options = useMemo(() => {
    const base = Number(item?.price || 0);
    const ten = Math.max(0, (base * 0.9).toFixed(2));
    const fifteen = Math.max(0, (base * 0.85).toFixed(2));
    return [
      { label: `Offer $${fifteen} (15% off)`, value: Number(fifteen) },
      { label: `Offer $${ten} (10% off)`, value: Number(ten) },
      { label: `Keep $${base.toFixed(2)}`, value: base },
    ];
  }, [item]);

  if (!isOpen || !item) return null;

  const submitOffer = async (offerPrice) => {
    try {
      setSending(true);
      const stored = localStorage.getItem("fs_user");
      const token = stored ? JSON.parse(stored)?.token : null;
      await axios.post(
        `${BACKEND_URL}/api/offers`,
        { itemId: item._id, offerPrice, message: note },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      onRequested?.({ offerPrice, note });
      onClose();
    } catch (e) {
      alert("Failed to send request.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{ background: "#fff", width: "min(92vw, 420px)", borderRadius: 12, padding: 16, boxShadow: "0 10px 24px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Request Item</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ color: "#475569", fontSize: 14, marginBottom: 10 }}>
          {item.name} • ${item.price.toFixed(2)}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {options.map((opt) => (
            <button
              key={opt.label}
              disabled={sending}
              onClick={() => submitOffer(opt.value)}
              style={{
                borderRadius: 9999, padding: "8px 12px", border: "1px solid #e2e8f0",
                background: "#fff", cursor: "pointer"
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          rows={3}
          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="market-card-btn request" onClick={() => submitOffer(options[0].value)} disabled={sending} style={{ flex: 1 }}>
            {sending ? "Sending..." : "Send Request"}
          </button>
          <button className="market-card-btn message" onClick={onClose} disabled={sending} style={{ flex: 1 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


