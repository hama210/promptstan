import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AdminPanel from "./admin/AdminPanelV3.jsx";
import "./styles.css";
import "./category-fix.css";
import "./admin/admin.css";

const isAdmin = window.location.pathname.startsWith("/admin");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAdmin ? <AdminPanel /> : <App />}
  </React.StrictMode>
);
