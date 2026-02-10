import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swPath = import.meta.env.BASE_URL + "sw.js";
    navigator.serviceWorker.register(swPath).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
