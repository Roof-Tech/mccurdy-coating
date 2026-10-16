import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installAdminFetch } from "./lib/admin-auth";

installAdminFetch();

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
