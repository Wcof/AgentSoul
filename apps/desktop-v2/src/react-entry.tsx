import React from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import { App } from "./App";

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
