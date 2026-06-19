import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
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

// Protect Admin Routes
const ProtectedRoute = ({ children }) => {
  const adminToken = localStorage.getItem("adminToken");

  return adminToken ? children : <Navigate to="/admin-login" replace />;
};

// Admin Layout (Without Navbar/Footer)
const AdminLayout = ({ children }) => {
  return <div className="admin-container">{children}</div>;
};

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) return <Loader />;

  return (
    <Router>
      <Routes>

        {/* ================= PUBLIC WEBSITE ================= */}

        <Route
          path="/"
          element={
            <>
              <Navbar />
              <Home />
              <Footer />
            </>
          }
        />

        <Route
          path="/contacts"
          element={
            <>
              <Navbar />
              <Contacts />
              <Footer />
            </>
          }
        />

        <Route
          path="/login"
          element={
            <>
              <Navbar />
              <Login />
              <Footer />
            </>
          }
        />

        <Route
          path="/signup"
          element={
            <>
              <Navbar />
              <Signup />
              <Footer />
            </>
          }
        />

        <Route
          path="/profile"
          element={
            <>
              <Navbar />
              <Profile />
              <Footer />
            </>
          }
        />

        {/* ================= ADMIN ================= */}

        <Route path="/admin-login" element={<AdminLogin />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Scanner Only For Admin */}

        <Route
          path="/services"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Services />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Invalid Route */}

        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}

export default App;