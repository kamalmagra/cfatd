import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Navbar from "./components/Navbar";
import Home from "./components/Home";
import Loader from "./components/Loader";
import Contacts from "./components/Contacts";
import Footer from "./components/Footer";
import Services from "./components/Services";
import Login from "./components/Login";
import Profile from "./components/Profile";
import Signup from "./components/Signup";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import AdminAnnouncements from "./components/AdminAnnouncements";
import AdminPersonalNotifications from "./components/AdminPersonalNotifications";
import AdminShiftPlanner from "./components/AdminShiftPlanner";
import AdminEmployees from "./components/AdminEmployees";
import AdminAnalytics from "./components/AdminAnalytics";
import AdminActivityLogs from "./components/AdminActivityLogs";
import AdminRealtime from "./components/AdminRealtime";
import PublicAnnouncements from "./components/PublicAnnouncements";

const ProtectedAdminRoute = ({ children }) => {
  const adminToken = localStorage.getItem("adminToken");

  return adminToken ? children : <Navigate to="/admin-login" replace />;
};

const AdminLayout = ({ children }) => {
  return <div className="admin-container">{children}</div>;
};

const PublicLayout = ({ children }) => {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
};

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <PublicLayout>
              <Home />
            </PublicLayout>
          }
        />

        <Route
          path="/contacts"
          element={
            <PublicLayout>
              <Contacts />
            </PublicLayout>
          }
        />

        <Route
          path="/login"
          element={
            <PublicLayout>
              <Login />
            </PublicLayout>
          }
        />

        <Route
          path="/signup"
          element={
            <PublicLayout>
              <Signup />
            </PublicLayout>
          }
        />

        <Route
          path="/profile"
          element={
            <PublicLayout>
              <Profile />
            </PublicLayout>
          }
        />

        <Route
          path="/public-announcements"
          element={
            <PublicLayout>
              <PublicAnnouncements />
            </PublicLayout>
          }
        />

        <Route path="/admin-login" element={<AdminLogin />} />

        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/services"
          element={
            <ProtectedAdminRoute>
              <AdminLayout>
                <Services />
              </AdminLayout>
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin-announcements"
          element={
            <ProtectedAdminRoute>
              <AdminLayout>
                <AdminAnnouncements />
              </AdminLayout>
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin-personal-notifications"
          element={
            <ProtectedAdminRoute>
              <AdminLayout>
                <AdminPersonalNotifications />
              </AdminLayout>
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin-shift-planner"
          element={
            <ProtectedAdminRoute>
              <AdminLayout>
                <AdminShiftPlanner />
              </AdminLayout>
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin-analytics"
          element={
            <ProtectedAdminRoute>
              <AdminLayout>
                <AdminAnalytics />
              </AdminLayout>
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin-realtime"
          element={
            <ProtectedAdminRoute>
              <AdminLayout>
                <AdminRealtime />
              </AdminLayout>
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin-activity-logs"
          element={
            <ProtectedAdminRoute>
              <AdminLayout>
                <AdminActivityLogs />
              </AdminLayout>
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin-employees"
          element={
            <ProtectedAdminRoute>
              <AdminLayout>
                <AdminEmployees />
              </AdminLayout>
            </ProtectedAdminRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
