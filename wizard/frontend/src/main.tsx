import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { preloadCardImages } from "./cardPreload";

// Fire-and-forget: starts loading all 69 card images immediately, in parallel
// with the app mounting. By the time a round starts, images are already cached.
preloadCardImages();

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
