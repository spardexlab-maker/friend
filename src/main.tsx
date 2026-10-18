import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Provider } from "./app-state";
import { CloudProvider, AuthGate, useCloudAuth } from "./cloud-auth";
import "./style.css";
import "./enhancements.css";
import "./performance.css";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "./refined.css";
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
