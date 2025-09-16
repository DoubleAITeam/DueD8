import React from "react";
import { useStore } from "../state/store";

export default function ConnectCanvas() {
  const connected = useStore(s => s.connected);
  const setConnected = useStore(s => s.setConnected);

  const handleConnect = () => {
    // TODO: replace with real OAuth/connect flow
    setConnected(true);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Connect Canvas</h1>
      <p>This is a placeholder connect screen.</p>

      <button onClick={handleConnect}>Simulate Connect</button>

      {/* Debug line so you know the toggle worked */}
      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        Connected state: {String(connected)}
      </p>
    </div>
  );
}