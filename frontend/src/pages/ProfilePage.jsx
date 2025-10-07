import { useEffect, useState } from "react";
import axios from "axios";
import "./profile.css";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [saving, setSaving] = useState(false);

  // ✅ Load user from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("fs_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      setName(parsed.profile?.name || "");
      setCollege(parsed.profile?.college || "");
    }
    setLoading(false);
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

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);

    try {
      // ✅ Update in backend too (so data persists)
      await axios.post(`${BACKEND_URL}/users/profile`, {
        username: user.username,
        name,
        college,
      });

      // ✅ Update locally
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

  return (
    <div className="profile-bg">
      <div className="profile-card">
        <h1 className="profile-title">My Profile</h1>

        {editing ? (
          <form className="profile-form" onSubmit={handleSave}>
            <div>
              <b>Username:</b> {user.username}
            </div>
            <div>
              <label>Name:</label>
              <input
                className="profile-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label>College:</label>
              <input
                className="profile-input"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                required
              />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="profile-btn"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                className="profile-btn"
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
            <div>
              <b>Username:</b> {user.username}
            </div>
            <div>
              <b>Name:</b> {user.profile.name || "Not set"}
            </div>
            <div>
              <b>College:</b> {user.profile.college || "Not set"}
            </div>
            <button
              className="profile-btn"
              onClick={() => setEditing(true)}
            >
              Edit Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
