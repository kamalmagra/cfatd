import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import "./index.css";
import App from "./App.jsx";

// Replace default browser alert with SweetAlert
window.alert = (message) => {
  Swal.fire({
    title: "Oops!",
    text: message,
    icon: "warning",

    confirmButtonText: "OK",

    confirmButtonColor: "#2563eb",

    background: "#ffffff",

    color: "#111827",

    allowOutsideClick: false,

    customClass: {
      popup: "custom-popup",
      title: "custom-title",
      confirmButton: "custom-button",
    },
  });
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);