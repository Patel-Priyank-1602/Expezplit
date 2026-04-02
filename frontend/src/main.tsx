import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./style.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ClerkProvider afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
