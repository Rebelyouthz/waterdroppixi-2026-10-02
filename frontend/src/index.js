import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
// Loaded after index.css so it inherits every :root variable and wins ties.
import "./overhaul.css";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
