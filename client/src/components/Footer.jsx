import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

const Footer = () => {
  const location = useLocation();

  const isActive = (path) =>
    location.pathname === path
      ? "text-white"
      : "text-gray-500 hover:text-white transition";

  return (
    <footer className="relative bg-black border-t border-white/10 text-white overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-0 left-20 w-72 h-72 bg-purple-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 right-20 w-72 h-72 bg-blue-600/10 blur-[120px] rounded-full"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-14">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

          {/* Company */}
          <div>
            <h2 className="text-3xl font-bold mb-4">
              Cargo Force
            </h2>

            <p className="text-gray-400 leading-7">
              Employee QR Attendance Management System.
              <br />
              Secure • Fast • Reliable
            </p>

            <div className="mt-6 inline-flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-4 py-2">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              <span className="text-sm text-gray-400">
                System Online
              </span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-xl font-semibold mb-5">
              Navigation
            </h3>

            <ul className="space-y-4">

              <li>
                <Link
                  to="/"
                  className={isActive("/")}
                >
                  Home
                </Link>
              </li>

              <li>
                <Link
                  to="/contacts"
                  className={isActive("/contacts")}
                >
                  Generate QR
                </Link>
              </li>

              <li>
                <Link
                  to="/login"
                  className={isActive("/login")}
                >
                  Login
                </Link>
              </li>

            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xl font-semibold mb-5">
              Contact
            </h3>

            <p className="text-gray-400 mb-6">
              Need help with the attendance system?
            </p>

            <a
              href="https://wa.me/+447438525575"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-4 bg-[#111] border border-white/10 rounded-2xl px-5 py-4 hover:bg-green-500 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faWhatsapp}
                  className="text-2xl text-white"
                />
              </div>

              <div>
                <p className="font-semibold text-white">
                  Parth Patel
                </p>

                <p className="text-gray-300 text-sm">
                  +447438525575
                </p>
              </div>
            </a>
          </div>

        </div>

        {/* Bottom */}

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col md:flex-row justify-between items-center">

          <p className="text-gray-500 text-sm text-center md:text-left">
            © {new Date().getFullYear()} Cargo Force.
            All Rights Reserved.
          </p>

          <p className="text-gray-500 text-sm mt-3 md:mt-0 text-center">
            Designed & Developed by{" "}
            <span className="text-white font-semibold">
              Kamlesh Magra
            </span>{" "}
           
          </p>

        </div>

      </div>

    </footer>
  );
};

export default Footer;