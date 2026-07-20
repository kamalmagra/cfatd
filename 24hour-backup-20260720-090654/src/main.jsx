import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import "./index.css";
import App from "./App.jsx";

/* Global SweetAlert helpers */
window.showSuccess = (message = "Task completed successfully.") => {
  Swal.fire({
    title: "Success!",
    text: message,
    icon: "success",
    confirmButtonText: "OK",
    confirmButtonColor: "#22c55e",
    background: "#050505",
    color: "#ffffff",
    allowOutsideClick: false,
    customClass: {
      popup: "cfatd-alert-popup",
      title: "cfatd-alert-title",
      confirmButton: "cfatd-alert-button",
    },
  });
};

window.showError = (message = "Something went wrong.") => {
  Swal.fire({
    title: "Oops!",
    text: message,
    icon: "error",
    confirmButtonText: "OK",
    confirmButtonColor: "#ef4444",
    background: "#050505",
    color: "#ffffff",
    allowOutsideClick: false,
    customClass: {
      popup: "cfatd-alert-popup",
      title: "cfatd-alert-title",
      confirmButton: "cfatd-alert-button",
    },
  });
};

window.showWarning = (message = "Please check this.") => {
  Swal.fire({
    title: "Warning!",
    text: message,
    icon: "warning",
    confirmButtonText: "OK",
    confirmButtonColor: "#f59e0b",
    background: "#050505",
    color: "#ffffff",
    allowOutsideClick: false,
    customClass: {
      popup: "cfatd-alert-popup",
      title: "cfatd-alert-title",
      confirmButton: "cfatd-alert-button",
    },
  });
};

window.showInfo = (message = "Information") => {
  Swal.fire({
    title: "Info",
    text: message,
    icon: "info",
    confirmButtonText: "OK",
    confirmButtonColor: "#3b82f6",
    background: "#050505",
    color: "#ffffff",
    allowOutsideClick: false,
    customClass: {
      popup: "cfatd-alert-popup",
      title: "cfatd-alert-title",
      confirmButton: "cfatd-alert-button",
    },
  });
};

/* Smart browser alert replacement */
window.alert = (message = "") => {
  const text = String(message).toLowerCase();

  const isSuccess =
    text.includes("success") ||
    text.includes("successful") ||
    text.includes("saved") ||
    text.includes("created") ||
    text.includes("updated") ||
    text.includes("generated") ||
    text.includes("login successful") ||
    text.includes("signup successful") ||
    text.includes("registered successfully") ||
    text.includes("download") ||
    text.includes("completed");

  const isError =
    text.includes("error") ||
    text.includes("failed") ||
    text.includes("invalid") ||
    text.includes("not found") ||
    text.includes("denied") ||
    text.includes("wrong") ||
    text.includes("old qr") ||
    text.includes("unauthorized") ||
    text.includes("blocked");

  if (isSuccess) {
    window.showSuccess(message);
  } else if (isError) {
    window.showError(message);
  } else {
    window.showWarning(message);
  }
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);