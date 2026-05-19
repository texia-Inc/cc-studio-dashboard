import React, { useEffect, useState } from "react";
import Portfolio from "./components/Portfolio.jsx";
import Scan from "./components/Scan.jsx";

const TABS = ["portfolio", "scan"];

export default function App() {
  const [tab, setTab] = useState("portfolio");
  const [status, setStatus] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  const reload = async () => {
    const [s, d] = await Promise.all([
      fetch("/api/status").then((r) => r.json()),
      fetch("/api/dashboard").then((r) => r.json()),
    ]);
    setStatus(s);
    setDashboard(d);
  };

  useEffect(() => {
    reload();
    const es = new EventSource("/api/events");
    es.addEventListener("update", (e) => {
      try {
        setDashboard(JSON.parse(e.data));
      } catch { /* empty */ }
    });
    return () => es.close();
  }, []);

  // Auto-switch to scan tab if studio not available
  useEffect(() => {
    if (status && !status.available && tab === "portfolio") {
      setTab("scan");
    }
  }, [status]);

  return (
    <div className="app">
      <header className="header">
        <h1>cc-studio dashboard</h1>
        <span className="tag">v{status?.version || "..."}</span>
        {status?.studioDir && (
          <span className="dim" style={{ fontSize: 12, marginLeft: "auto" }}>
            {status.studioDir}
          </span>
        )}
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "portfolio" ? "Portfolio" : "Scan & Import"}
          </button>
        ))}
      </nav>

      <main className="content">
        {!status && <div className="empty">Loading...</div>}
        {status && tab === "portfolio" && (
          <Portfolio status={status} dashboard={dashboard} />
        )}
        {status && tab === "scan" && (
          <Scan status={status} onImported={reload} />
        )}
      </main>
    </div>
  );
}
