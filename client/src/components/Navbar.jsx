import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "../assets/Copilot_20260610_092835.png";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const profileRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("userToken");

    if (token) {
      try {
        const decodedUser = JSON.parse(atob(token.split(".")[1]));
        setUser(decodedUser.username);
      } catch (error) {
        localStorage.removeItem("userToken");
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userToken");
    setUser(null);
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  const menuItems = [
    { name: "Overview", path: "/", icon: "⌘" },
    { name: "Generate QR", path: "/contacts", icon: "▣" },
    {
      name: "Announcements",
      path: "/public-announcements",
      icon: "!",
    },
    { name: "Admin Login", path: "/admin-login", icon: "◆" },
    { name: "Profile", path: "/profile", icon: "◉" },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 bg-black border-b border-white/10">
        <div className="w-full flex justify-between items-center px-5 md:px-8 py-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={Logo}
              alt="Logo"
              className="h-11 w-11 rounded-xl object-contain"
            />

            <div>
              <h1 className="text-white text-xl font-bold tracking-tight">
                Cargo Force
              </h1>
              <p className="text-gray-500 text-xs">Attendance System</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-3 bg-[#111] border border-white/10 rounded-2xl p-2">
            <Link
              to="/"
              className={`px-5 py-2 rounded-xl text-sm font-medium transition ${
                isActive("/")
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              Overview
            </Link>

            <Link
              to="/contacts"
              className={`px-5 py-2 rounded-xl text-sm font-medium transition ${
                isActive("/contacts")
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              Generate QR
            </Link>

            <Link
              to="/public-announcements"
              className={`px-5 py-2 rounded-xl text-sm font-medium transition ${
                isActive("/public-announcements")
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              Announcements
            </Link>

            <Link
              to="/admin-login"
              className={`px-5 py-2 rounded-xl text-sm font-medium transition ${
                isActive("/admin-login")
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              Admin
            </Link>
          </div>

          <div className="hidden md:block relative" ref={profileRef}>
            {user ? (
              <>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-3 bg-[#111] border border-white/10 rounded-2xl px-3 py-2"
                >
                  <div className="w-9 h-9 rounded-full bg-[#333] text-white flex items-center justify-center font-bold">
                    {user.charAt(0).toUpperCase()}
                  </div>

                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">{user}</p>
                    <p className="text-gray-500 text-xs">Employee account</p>
                  </div>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-14 w-56 bg-[#111] border border-white/10 rounded-2xl shadow-xl p-2">
                    <Link
                      to="/profile"
                      className="block px-4 py-3 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white"
                    >
                      Profile
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-5 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10"
                >
                  Login
                </Link>

                <Link
                  to="/signup"
                  className="px-5 py-2 rounded-xl bg-white text-black font-semibold hover:bg-gray-200"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden w-10 h-10 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center text-white"
          >
            ☰
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm md:hidden">
          <div className="h-full w-[86%] max-w-[360px] bg-black text-white p-6 shadow-2xl border-r border-white/10 relative">
            <div className="flex items-center justify-between mb-8">
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3"
              >
                <img
                  src={Logo}
                  alt="Logo"
                  className="h-11 w-11 rounded-xl object-contain"
                />

                <div>
                  <h2 className="text-xl font-bold">Cargo Force</h2>
                  <p className="text-gray-500 text-xs">Attendance system</p>
                </div>
              </Link>

              <button
                onClick={() => setMenuOpen(false)}
                className="w-10 h-10 rounded-full bg-white/10 text-2xl flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-2xl p-1 flex mb-7">
              <button className="w-1/2 bg-white text-black rounded-xl py-2 text-sm font-semibold">
                Personal
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/admin-login");
                }}
                className="w-1/2 text-gray-500 rounded-xl py-2 text-sm"
              >
                Admin
              </button>
            </div>

            <div className="flex items-center justify-between mb-7">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center text-white font-bold">
                    {user.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h3 className="font-bold text-white">{user}</h3>
                    <p className="text-gray-500 text-sm">Employee account</p>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="font-bold text-white">Guest User</h3>
                  <p className="text-gray-500 text-sm">Please login first</p>
                </div>
              )}

              {user && (
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="bg-white/10 px-3 py-1 rounded-full text-sm text-gray-300"
                >
                  Edit
                </Link>
              )}
            </div>

            <p className="text-gray-500 text-sm mb-3">Menu</p>

            <div className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition ${
                    isActive(item.path)
                      ? "bg-white/15 text-white"
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="w-6 text-center text-lg">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              ))}
            </div>

            <div className="absolute bottom-6 left-6 right-6">
              {user ? (
                <button
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                  className="w-full py-3 rounded-2xl bg-red-500/10 text-red-400 font-semibold"
                >
                  Logout
                </button>
              ) : (
                <div className="space-y-3">
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full text-center py-3 rounded-2xl bg-white/10 text-white font-semibold"
                  >
                    Login
                  </Link>

                  <Link
                    to="/signup"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full text-center py-3 rounded-2xl bg-white text-black font-bold"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
