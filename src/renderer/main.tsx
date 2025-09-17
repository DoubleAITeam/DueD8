import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx"; // ✅ explicit, matches location

createRoot(document.getElementById("root")!).render(<App />);