/**
 * =============================================================================
 * Module: frontend/src/main.tsx
 * Purpose: Frontend application entry point mounting React root DOM.
 * Used by: frontend/index.html
 * Dependencies: React, ReactDOM, frontend/src/App.tsx, frontend/src/index.css
 * Public Members: None
 * Side Effects: Mounts React component tree into #root DOM node.
 * =============================================================================
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
