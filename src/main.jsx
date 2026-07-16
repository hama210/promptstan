import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AdminPanel from "./admin/AdminDashboard.jsx";
import "./shareAnalytics.js";
import "./styles.css";
import "./preview-images.css";
import "./shareable-prompts.css";
import "./admin/admin.css";
import "./admin/campaign.css";
import "./admin/phase6.css";
import "./admin/automation.css";
import "./admin/intelligence.css";
import "./admin/operations.css";

const isAdmin = window.location.pathname.startsWith("/admin");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAdmin ? <AdminPanel /> : <App />}
  </React.StrictMode>
);
