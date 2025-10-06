import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./profile.css";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ProfileSetup({ onComplete }) {
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [saving, setSaving] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!name || !college) return;
    setSaving(true);

    try {
      const stored = JSON.parse(localStorage.getItem("fs_user"));
      const username = stored?.username;

      if (!username) {
        alert("User not logged in");
        setSaving(false);
        return;
      }

      // Save profile to backend
      await axios.post(`${BACKEND_URL}/users/profile`, {
        username,
        name,
        college,
      });

      // Update local copy
      onComplete?.({ name, college });
      nav("/marketplace");
    } catch (err) {
      console.error("❌ Profile save error:", err);
      alert("Error saving profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-bg">
      <div className="profile-card">
        <h1 className="profile-title">Complete your profile</h1>
        <p className="profile-desc">Tell classmates who you are</p>
        <form onSubmit={submit} className="profile-form">
          <div>
            <label className="profile-label">Full name</label>
            <input
              className="profile-input"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="profile-label">College</label>
            <select
              className="profile-input"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              required
            >
              <option value="" disabled>Select your college</option>
              <option value="UC Berkeley">UC Berkeley</option>
              <option value="Stanford University">Stanford University</option>
              <option value="UCLA">UCLA</option>
              <option value="USC">USC</option>
              <option value="UC San Diego">UC San Diego</option>
              <option value="UC Davis">UC Davis</option>
              <option value="UC Irvine">UC Irvine</option>
              <option value="UC Santa Barbara">UC Santa Barbara</option>
              <option value="UC Santa Cruz">UC Santa Cruz</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!name || !college || saving}
            className="profile-btn"
          >
            {saving ? "Saving…" : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
