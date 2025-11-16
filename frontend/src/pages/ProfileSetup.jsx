import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { TextField, Autocomplete, Popper } from "@mui/material";
import { colleges } from "../data/colleges";
import "./profile.css";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// 👇 Custom Popper that disables "flipping" logic
function CustomPopper(props) {
  return (
    <Popper
      {...props}
      placement="bottom-start"
      modifiers={[
        {
          name: "flip",
          enabled: false, // 🚫 disable flipping
        },
        {
          name: "preventOverflow",
          enabled: true,
          options: {
            altAxis: false,
            tether: false,
          },
        },
      ]}
      style={{
        zIndex: 1300, // above modal/dialog layers
      }}
    />
  );
}

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

      const res = await axios.post(`${BACKEND_URL}/users/profile`, {
        username,
        name,
        college,
      });

      console.log("✅ Profile updated:", res.data);

      const updatedUser = { ...stored, profile: { name, college } };
      localStorage.setItem("fs_user", JSON.stringify(updatedUser));

      onComplete?.({ name, college });
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
        <h1 className="profile-title setup-title">Complete profile</h1>

        <form onSubmit={submit} className="profile-form" autoComplete="off">
          {/* Full name */}
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

          {/* College with forced dropdown below */}
          <div style={{ position: "relative", zIndex: 10 }}>
            <label className="profile-label">College</label>
            <Autocomplete
              options={colleges}
              value={college}
              onChange={(e, newValue) => setCollege(newValue || "")}
              onInputChange={(e, newValue) => setCollege(newValue || "")}
              freeSolo
              disablePortal
              PopperComponent={CustomPopper} // 👈 the key line
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search for your college"
                  variant="outlined"
                  required
                  fullWidth
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

          {/* Save */}
          <button
            type="submit"
            disabled={!name || !college || saving}
            className="profile-btn"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
