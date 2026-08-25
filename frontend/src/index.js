import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
// Loaded after index.css so it inherits every :root variable and wins ties.
import "./overhaul.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import WaterCursor from "./components/WaterCursor";

const root = ReactDOM.createRoot(document.getElementById("root"));
// Wrapped so a render error anywhere shows a reload screen instead of
// unmounting the whole game to a blank black page. See ErrorBoundary.jsx.
root.render(
  <ErrorBoundary>
    <App />
    {/* Sibling of <App/>, not a child of any screen: the cursor has to
        outlive every screen transition, and nesting it inside App would
        remount it on each view change. Inside the boundary so a cursor
        bug can never take the game down with it. */}
    <WaterCursor />
  </ErrorBoundary>
);
