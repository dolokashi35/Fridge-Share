import { useLocation, useNavigate } from "react-router-dom";
import { FaHome, FaPlusCircle, FaUser, FaList, FaComments, FaMap } from "react-icons/fa";
import "./bottomnav.css";
import logo from "../assets/fridgeshare-logo.png"; // ✅ import your logo

export default function BottomNav() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const getInitials = (name, username) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return name[0].toUpperCase();
    }
    if (username) return (username[0] || '?').toUpperCase();
    return null;
  };
  let user = null;
  try { const raw = localStorage.getItem('fs_user'); user = raw ? JSON.parse(raw) : null; } catch {}
  const initials = getInitials(user?.profile?.name, user?.username);

  const items = [
    { label: "Market", icon: <FaHome />, path: "/marketplace" },
    { label: "Map", icon: <FaMap />, path: "/map" },
    { label: "Post", icon: <FaPlusCircle />, path: "/post" },
    { label: "My Listings", icon: <FaList />, path: "/mylistings" },
    { label: "Chat", icon: <FaComments />, path: "/chat" },
  ];

  const profileItem = { icon: <FaUser />, path: "/profile" };

  return (
    <div className="bottom-navbar">
      {/* ✅ Logo on the left */}
      <img
        src={logo}
        alt="FridgeShare Logo"
        className="bottom-navbar-logo"
        onClick={() => nav("/marketplace")}
      />

      {/* Normal buttons */}
      <div className="bottom-navbar-buttons">
        {items.map((it) => {
          const active = pathname === it.path;
          return (
            <button
              key={it.path}
              onClick={() => nav(it.path)}
              className={`bottom-navbar-btn ${active ? "active" : ""}`}
            >
              <span className="bottom-navbar-icon">{it.icon}</span>
              {it.label}
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <div className="navbar-separator" />

      {/* Profile icon only */}
      <button
        onClick={() => {
          try {
            const raw = localStorage.getItem('fs_user');
            const user = raw ? JSON.parse(raw) : null;
            if (user && user.username) {
              nav(profileItem.path);
            } else {
              nav('/login');
            }
          } catch {
            nav('/login');
          }
        }}
        className="bottom-navbar-btn profile-btn"
      >
        {initials ? (
          <span className="profile-initials-badge" aria-label="My Profile">{initials}</span>
        ) : (
          <FaUser />
        )}
      </button>
    </div>
  );
}
