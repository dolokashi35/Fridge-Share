import { useEffect, useState } from "react";
import axios from "axios";
import { TextField, Autocomplete, Popper } from "@mui/material";
import { colleges } from "../data/colleges";
import "./profile.css";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// 👇 Custom Popper to keep dropdown below
function CustomPopper(props) {
  return (
    <Popper
      {...props}
      placement="bottom-start"
      modifiers={[
        {
          name: "flip",
          enabled: false, // disables "flipping" up
        },
        {
          name: "preventOverflow",
          enabled: true,
          options: { altAxis: false, tether: false },
        },
      ]}
      style={{ zIndex: 1300 }}
    />
  );
}

// Generate avatar initials from name or username
function getInitials(name, username) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
  if (username) {
    return username[0].toUpperCase();
  }
  return "?";
}

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [saving, setSaving] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifySending, setVerifySending] = useState(false);
  const [stats, setStats] = useState({ averageRating: 0, salesCount: 0, purchaseCount: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  // ✅ Load user from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("fs_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      setName(parsed.profile?.name || "");
      setCollege(parsed.profile?.college || "");
      setVerified(!!parsed.isVerified);
    }
    setLoading(false);
  }, []);

  // Load Stripe Connect status
  useEffect(() => {
    const go = async () => {
      try {
        const stored = localStorage.getItem("fs_user");
        const token = stored ? JSON.parse(stored)?.token : null;
        if (!token) return;
        const res = await axios.get(`${BACKEND_URL}/payments/connect/status`, { headers: { Authorization: `Bearer ${token}` } });
        setOnboarded(!!res.data?.onboarded);
      } catch {}
    };
    go();
  }, []);

  async function handleOnboard() {
    try {
      const stored = localStorage.getItem("fs_user");
      const token = stored ? JSON.parse(stored)?.token : null;
      if (!token) {
        alert("Please log in to set up payouts.");
        return;
      }
      const payload = {
        returnUrl: `${window.location.origin}/profile?onboard=done`,
        refreshUrl: `${window.location.origin}/profile?onboard=refresh`,
      };
      const res = await axios.post(
        `${BACKEND_URL}/payments/connect/link`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        console.error("Onboarding link response:", res.data);
        alert("Could not start payouts onboarding. Check backend Stripe config.");
      }
    } catch (e) {
      console.error("Onboarding error:", e?.response?.data || e?.message || e);
      alert(e?.response?.data?.error || "Failed to start onboarding.");
    }
  }

  async function handleSendVerification() {
    try {
      setVerifySending(true);
      const stored = localStorage.getItem("fs_user");
      const token = stored ? JSON.parse(stored)?.token : null;
      await axios.post(`${BACKEND_URL}/users/verify/send`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      alert("Verification email sent to your .edu address.");
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to send verification email.");
    } finally {
      setVerifySending(false);
    }
  }

  // ✅ Fetch user stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stored = localStorage.getItem("fs_user");
        const token = stored ? JSON.parse(stored)?.token : null;
        if (!token) {
          setLoadingStats(false);
          return;
        }

        const res = await axios.get(`${BACKEND_URL}/users/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats({
          averageRating: res.data.averageRating || 0,
          salesCount: res.data.salesCount || 0,
          purchaseCount: res.data.purchaseCount || 0,
        });
      } catch (err) {
        console.error("Failed to fetch user stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  if (loading)
    return (
      <div className="profile-bg">
        <div className="profile-card">Loading…</div>
      </div>
    );

  if (!user || !user.profile)
    return (
      <div className="profile-bg">
        <div className="profile-card">No profile found.</div>
      </div>
    );

  // ✅ Handle save
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);

    try {
      await axios.post(`${BACKEND_URL}/users/profile`, {
        username: user.username,
        name,
        college,
      });

      const updated = { ...user, profile: { name, college } };
      setUser(updated);
      localStorage.setItem("fs_user", JSON.stringify(updated));
      setEditing(false);
    } catch (err) {
      console.error("❌ Profile update failed:", err);
      alert("Could not update profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const initials = getInitials(user?.profile?.name, user?.username);

  return (
    <div className="profile-bg">
      <div className="profile-card">
        {/* Header with gradient, toolbar, and avatar */}
        <div className="profile-header">
          <div className="profile-header-content">
            <div>
              <h1 className="profile-title">My Profile</h1>
              <p className="profile-subtitle">
                Manage your FridgeShare identity, reputation, and preferences in one place.
              </p>
            </div>
            <button
              className="profile-settings-btn"
              type="button"
              onClick={() => setEditing(true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
              Edit Profile
            </button>
          </div>
          <div className="profile-avatar" title={user?.profile?.name || user?.username}>
            {initials}
          </div>
        </div>

        {editing ? (
          <form className="profile-form" onSubmit={handleSave}>
            <div className="profile-info-item">
              <span className="profile-label">Username</span>
              <span className="profile-value">{user.username}</span>
            </div>

            {/* Name */}
            <div className="profile-form-group">
              <label className="profile-form-label">Name</label>
              <input
                className="profile-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* College Autocomplete */}
            <div className="profile-form-group" style={{ position: "relative", zIndex: 10 }}>
              <label className="profile-form-label">College</label>
              <Autocomplete
                options={colleges}
                value={college}
                onChange={(e, newValue) => setCollege(newValue || "")}
                onInputChange={(e, newValue) => setCollege(newValue || "")}
                freeSolo
                disablePortal
                PopperComponent={CustomPopper}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search for your college"
                    variant="outlined"
                    fullWidth
                    required
                  />
                )}
                sx={{
                  mt: 1,
                  mb: 2,
                  backgroundColor: "white",
                  borderRadius: 1,
                }}
              />
            </div>

            <div className="profile-form-actions">
              <button
                className="profile-btn-primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                className="profile-btn-secondary"
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-info">
            {/* Basic Info Block */}
            <div className="profile-info-block">
              <div className="profile-info-item">
                <span className="profile-label">Name</span>
                <span className="profile-value">{user.profile.name || "Not set"}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-label">Email</span>
                <span className="profile-value">{user.username}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-label">College</span>
                <span className="profile-value">{user.profile.college || "Not set"}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-label">Member since</span>
                <span className="profile-value">Active member</span>
              </div>
            </div>
            <div className="profile-info-item">
              <span className="profile-label">Payouts</span>
              {onboarded ? (
                <span className="profile-value">Connected</span>
              ) : (
                <button className="profile-btn-primary" onClick={handleOnboard}>Set up payouts</button>
              )}
            </div>
            <div className="profile-info-item">
              <span className="profile-label">Email Verification (.edu)</span>
              {verified ? (
                <span className="profile-value">Verified</span>
              ) : (
                <button className="profile-btn-secondary" onClick={handleSendVerification} disabled={verifySending}>
                  {verifySending ? 'Sending…' : 'Send verification email'}
                </button>
              )}
            </div>

            {/* Stats Grid */}
            {!loadingStats && (
              <div className="profile-stats-grid">
                <div className="profile-stat-item">
                  <div className="profile-stat-label">
                    <span className="profile-stat-icon">⭐</span>
                    Rating
                  </div>
                  <div className="profile-stat-value">
                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—'}
                  </div>
                </div>
                <div className="profile-stat-divider"></div>
                <div className="profile-stat-item">
                  <div className="profile-stat-label">
                    <span className="profile-stat-icon">💰</span>
                    Sales
                  </div>
                  <div className="profile-stat-value">
                    {stats.salesCount}
                  </div>
                </div>
                <div className="profile-stat-divider"></div>
                <div className="profile-stat-item">
                  <div className="profile-stat-label">
                    <span className="profile-stat-icon">📦</span>
                    Purchases
                  </div>
                  <div className="profile-stat-value">
                    {stats.purchaseCount}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="profile-actions">
              <button
                className="profile-btn-primary"
                onClick={() => setEditing(true)}
              >
                Edit Profile
              </button>
              <button
                className="profile-btn-secondary"
                onClick={() => {
                  try {
                    localStorage.removeItem("fs_user");
                    localStorage.removeItem("userProfile"); // legacy key cleanup
                  } finally {
                    window.location.replace("/login");
                  }
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
