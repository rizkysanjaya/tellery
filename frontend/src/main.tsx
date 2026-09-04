/**
 * =============================================================================
 * Module: frontend/src/main.tsx
 * Purpose: Frontend application entry point mounting React root DOM with ErrorBoundary protection.
 * Used by: frontend/index.html
 * Dependencies: React, ReactDOM, frontend/src/App.tsx, frontend/src/components/ui/ErrorBoundary.tsx, frontend/src/index.css
 * Public Members: None
 * Side Effects: Mounts React component tree into #root DOM node.
 * =============================================================================
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
