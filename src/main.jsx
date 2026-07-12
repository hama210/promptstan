import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AdminPanel from "./admin/AdminPanelV8.jsx";
import "./promptIdentityMap.js";
import "./shareAnalytics.js";
import "./styles.css";
import "./category-fix.css";
import "./no-categories.css";
import "./shareable-prompts.css";
import "./admin/admin.css";
import "./admin/campaign.css";
import "./admin/phase6.css";
import "./admin/automation.css";
import "./admin/intelligence.css";

const isAdmin = window.location.pathname.startsWith("/admin");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAdmin ? <AdminPanel /> : <App />}
  </React.StrictMode>
);
