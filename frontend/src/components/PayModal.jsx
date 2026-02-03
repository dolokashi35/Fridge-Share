import { useEffect, useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

function PayForm({ item, onClose, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.origin + "/pay/success" },
      redirect: "if_required",
    });
    setLoading(false);
    if (error) {
      setError(error.message || "Payment failed. Try again.");
    } else {
      onSuccess?.();
    }
  };

  return (
    <div>
      <PaymentElement />
      {error && <p style={{ color: "#ef4444", marginTop: 8 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="market-card-btn message" style={{ flex: 1 }} onClick={onClose} disabled={loading}>Cancel</button>
        <button className="market-card-btn request" style={{ flex: 1 }} onClick={handlePay} disabled={!stripe || loading}>
          {loading ? "Processing..." : "Pay"}
        </button>
      </div>
    </div>
  );
}

export default function PayModal({ item, isOpen, onClose }) {
  const [clientSecret, setClientSecret] = useState("");
  const [loadingCS, setLoadingCS] = useState(false);
  const [error, setError] = useState("");
  const [stripePromise, setStripePromise] = useState(null);
  const [loadingPK, setLoadingPK] = useState(false);

  const fetchClientSecret = useCallback(async () => {
    setError("");
    setLoadingCS(true);
    try {
      const id = item?._id || item?.id;
      if (!id) {
        setError("Please log in and select a live listing to purchase.");
        return;
      }
      const stored = localStorage.getItem("fs_user");
      const token = stored ? JSON.parse(stored)?.token : null;
      const res = await axios.post(
        `${BACKEND_URL}/purchase/buy-now`,
        { itemId: id, amountCents: Math.round((item.price || 0) * 100), currency: "usd" },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      const cs = res.data?.clientSecret || "";
      if (!cs) {
        setError("Payment initialization failed (no client secret).");
        return;
      }
      setClientSecret(cs);
    } catch (e) {
      console.error("Failed to create intent", e);
      const msg = e?.response?.data?.error || e?.message || "Failed to create payment";
      setError(msg);
    } finally {
      setLoadingCS(false);
    }
  }, [item]);

  const ensureStripe = useCallback(async () => {
    setLoadingPK(true);
    setError("");
    try {
      const envPk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (envPk) {
        setStripePromise(loadStripe(envPk));
        return true;
      }
      // Fallback to backend-provided key
      const res = await axios.get(`${BACKEND_URL}/payments/pk`);
      const pk = res.data?.pk || "";
      if (!pk) {
        setError("Payments not configured (missing publishable key).");
        return false;
      }
      setStripePromise(loadStripe(pk));
      return true;
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Failed to load Stripe key";
      setError(msg);
      return false;
    } finally {
      setLoadingPK(false);
    }
  }, []);

  useEffect(() => {
    const go = async () => {
      if (!isOpen || !item) return;
      setClientSecret("");
      const ok = await ensureStripe();
      if (ok) {
        await fetchClientSecret();
      }
    }
    go();
  }, [isOpen, item, ensureStripe, fetchClientSecret]);

  if (!isOpen) return null;
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3100 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: 420, maxWidth: "92%", padding: 16 }}>
        <h3 style={{ margin: 0, marginBottom: 6, fontWeight: 700 }}>Pay {item?.name}</h3>
        <p style={{ marginTop: 0, color: "#64748b" }}>${(item?.price || 0).toFixed(2)}</p>
        {clientSecret && stripePromise ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PayForm item={item} onClose={onClose} onSuccess={onClose} />
          </Elements>
        ) : (
          <div>
            <div style={{ color: "#64748b" }}>
              {(loadingPK || loadingCS) ? "Loading payment…" : (error || "Loading payment…")}
            </div>
            {error && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="market-card-btn message" style={{ flex: 1 }} onClick={onClose}>Close</button>
                <button className="market-card-btn request" style={{ flex: 1 }} onClick={async () => { await ensureStripe(); await fetchClientSecret(); }}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
