import React from "react";
import ReactDOM from "react-dom/client";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";

import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { createMsalConfig } from "./authConfig";

const root = ReactDOM.createRoot(document.getElementById("root"));

async function startApp() {
  const response = await fetch("/api/client-config");

  if (!response.ok) {
    throw new Error("Client configuration could not be loaded.");
  }

  const clientConfig = await response.json();
  const msalInstance = new PublicClientApplication(createMsalConfig(clientConfig));

  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  );
}

startApp().catch((error) => {
  console.error(error);
  root.render(
    <React.StrictMode>
      <div>Client configuration could not be loaded.</div>
    </React.StrictMode>
  );
});

reportWebVitals();
