import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Provider } from "./app-state";
import { CloudProvider, AuthGate, useCloudAuth } from "./cloud-auth";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./style.css";
import "./enhancements.css";
import "./performance.css";
function SessionApp() {
  const { user } = useCloudAuth();
  return (
    <Provider key={user?.id ?? "local"}>
      <App />
    </Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <CloudProvider>
    <AuthGate>
      <SessionApp />
    </AuthGate>
  </CloudProvider>,
);
