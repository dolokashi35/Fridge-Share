import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Login from "./pages/Login";
import ProfileSetup from "./pages/ProfileSetup";
import Marketplace from "./pages/Marketplace";
import PostItem from "./pages/PostItem";
import MyListings from "./pages/MyListings";
import ItemDetail from "./pages/ItemDetail";
import ProfilePage from "./pages/ProfilePage";
import EditListing from "./pages/EditListing";
import ChatPage from "./pages/ChatPage";
import MapDiscovery from "./components/MapDiscovery";
import BottomNav from "./components/BottomNav";
import { SocketProvider } from "./contexts/SocketContext";
import Verify from "./pages/Verify";
import VerifyPending from "./pages/VerifyPending";

function AppContent() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("fs_user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem("fs_user", JSON.stringify(user));
    else localStorage.removeItem("fs_user");
  }, [user]);

  const location = useLocation();
  const hideNavOn = ["/login", "/setup", "/verify", "/verify-pending"];

  return (
    <>
      {/* ✅ Global Top Navbar */}
      {user && user.profile && !hideNavOn.includes(location.pathname) && (
        <BottomNav />
      )}

      {/* ✅ Main Page Content */}
      <div style={{ paddingTop: 0 }}>
        <Routes>
          {/* ✅ Login */}
          <Route
            path="/login"
            element={
              <Login
                onAuth={(token, username, profile) =>
                  setUser({ token, username, profile })
                }
              />
            }
          />

          {/* ✅ Profile Setup */}
          <Route
            path="/setup"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : user.profile ? (
                <Navigate to="/marketplace" />
              ) : (
                <ProfileSetup
                  onComplete={(profile) =>
                    setUser((u) => ({ ...u, profile }))
                  }
                />
              )
            }
          />
          
          {/* ✅ Email Verification */}
          <Route path="/verify" element={<Verify />} />
          <Route path="/verify-pending" element={<VerifyPending />} />

          {/* ✅ Marketplace */}
          <Route
            path="/marketplace"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : !user.profile ? (
                <Navigate to="/setup" />
              ) : (
                <Marketplace />
              )
            }
          />

          {/* ✅ Map Discovery */}
          <Route
            path="/map"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : !user.profile ? (
                <Navigate to="/setup" />
              ) : (
                <MapDiscovery />
              )
            }
          />

          {/* ✅ Item Detail */}
          <Route
            path="/items/:id"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : !user.profile ? (
                <Navigate to="/setup" />
              ) : (
                <ItemDetail />
              )
            }
          />

          {/* ✅ Post Item */}
          <Route
            path="/post"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : !user.profile ? (
                <Navigate to="/setup" />
              ) : (
                <PostItem />
              )
            }
          />

          {/* ✅ My Listings */}
          <Route
            path="/mylistings"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : !user.profile ? (
                <Navigate to="/setup" />
              ) : (
                <MyListings />
              )
            }
          />

          {/* ✅ Profile Page */}
          <Route
            path="/profile"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : !user.profile ? (
                <Navigate to="/setup" />
              ) : (
                <ProfilePage />
              )
            }
          />

          {/* ✅ Edit Listing */}
          <Route
            path="/edit/:id"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : !user.profile ? (
                <Navigate to="/setup" />
              ) : (
                <EditListing />
              )
            }
          />

          {/* ✅ Chat */}
          <Route
            path="/chat"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : !user.profile ? (
                <Navigate to="/setup" />
              ) : (
                <ChatPage currentUser={user.username} />
              )
            }
          />

          {/* ✅ Default Redirect */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </Router>
  );
}
