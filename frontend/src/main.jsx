import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Self-hosted, bundled fonts - not a Google Fonts CDN link. This means the
// app's typography renders identically whether the demo runs on a corporate
// network, a firewalled venue wifi, or fully offline - no external request,
// no dependency on fonts.googleapis.com being reachable at demo time.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
