import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { TextField, Autocomplete } from "@mui/material";
import { colleges } from "../data/colleges"; // 👈 make sure this file exists
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

      console.log("➡️ Sending profile to backend:", { username, name, college });

      // Save profile to backend
      const res = await axios.post(`${BACKEND_URL}/users/profile`, {
        username,
        name,
        college,
      });

      console.log("✅ Profile updated:", res.data);

      // Update localStorage user data
      const updatedUser = { ...stored, profile: { name, college } };
      localStorage.setItem("fs_user", JSON.stringify(updatedUser));

      // Update parent state
      onComplete?.({ name, college });

      // Redirect to marketplace
      nav("/marketplace");
    } catch (err) {
      console.error("❌ Profile save error:", err.response?.data || err.message);
      alert("Error saving profile. Please try again.");
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
            <Autocomplete
              options={colleges}
              value={college}
              onChange={(e, newValue) => setCollege(newValue)}
              freeSolo // 👈 allows typing if college not in list
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search for your college"
                  variant="outlined"
                  required
                  fullWidth
                />
              )}
              sx={{ mt: 1, mb: 2 }}
            />
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
