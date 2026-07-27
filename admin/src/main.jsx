import React from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./lib/auth.jsx";
import { ContentProvider } from "./lib/content.jsx";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ContentProvider>
        <App />
      </ContentProvider>
    </AuthProvider>
  </React.StrictMode>
);
