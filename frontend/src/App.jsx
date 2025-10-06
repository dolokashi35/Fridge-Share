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
import BottomNav from "./components/BottomNav";

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
  const hideNavOn = ["/login", "/setup"];

  return (
    <div style={{ paddingBottom: 56 }}>
      <Routes>
        <Route
          path="/login"
          element={<Login onAuth={(token, username) => setUser({ token, username, profile: null })} />}
        />
        <Route
          path="/setup"
          element={
            !user ? (
              <Navigate to="/login" />
            ) : user.profile ? (
              <Navigate to="/marketplace" />
            ) : (
              <ProfileSetup onComplete={(profile) => setUser((u) => ({ ...u, profile }))} />
            )
          }
        />
        <Route
          path="/marketplace"
          element={
            !user ? <Navigate to="/login" /> : !user.profile ? <Navigate to="/setup" /> : <Marketplace />
          }
        />
        <Route
          path="/items/:id"
          element={
            !user ? <Navigate to="/login" /> : !user.profile ? <Navigate to="/setup" /> : <ItemDetail />
          }
        />
        <Route
          path="/post"
          element={
            !user ? <Navigate to="/login" /> : !user.profile ? <Navigate to="/setup" /> : <PostItem />
          }
        />
        <Route
          path="/mylistings"
          element={
            !user ? <Navigate to="/login" /> : !user.profile ? <Navigate to="/setup" /> : <MyListings />
          }
        />
        <Route
          path="/profile"
          element={
            !user ? <Navigate to="/login" /> : !user.profile ? <Navigate to="/setup" /> : <ProfilePage />
          }
        />
        <Route
          path="/edit/:id"
          element={
            !user ? <Navigate to="/login" /> : !user.profile ? <Navigate to="/setup" /> : <EditListing />
          }
        />
        <Route
          path="/chat"
          element={
            !user ? <Navigate to="/login" /> : !user.profile ? <Navigate to="/setup" /> : <ChatPage currentUser={user.username} />
          }
        />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>

      {/* Hide navbar on login/setup */}
      {user && user.profile && !hideNavOn.includes(location.pathname) && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
