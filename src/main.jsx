import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { initTelemetry } from './utils/telemetry';

console.log("[App Startup] main.jsx execution started");
initTelemetry();

// Register service worker for background push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log("[App Startup] Registering Service Worker...");
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log("[App Startup] Service Worker registered successfully:", reg.scope);
    }).catch((err) => {
      console.warn("[App Startup] Service Worker registration failed:", err);
    });
  });
}

console.log("[App Startup] Rendering React tree inside root element");
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
