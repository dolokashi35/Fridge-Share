
import { useLocation, useNavigate } from "react-router-dom";
import { FaHome, FaPlusCircle, FaUser, FaList, FaComments } from "react-icons/fa";

export default function BottomNav() {
  const nav = useNavigate();
  const { pathname } = useLocation();

  const items = [
    { label: "Market", icon: <FaHome />, path: "/marketplace" },
    { label: "Post", icon: <FaPlusCircle />, path: "/post" },
    { label: "My Listings", icon: <FaList />, path: "/mylistings" },
    { label: "Chat", icon: <FaComments />, path: "/chat" },
    { label: "Profile", icon: <FaUser />, path: "/profile" },
  ];

  return (
    <div className="bottom-navbar">
      {items.map((it) => {
        const active = pathname === it.path;
        return (
          <button
            key={it.path}
            onClick={() => nav(it.path)}
            className={"bottom-navbar-btn" + (active ? " active" : "")}
          >
            <span className="bottom-navbar-icon">{it.icon}</span>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
