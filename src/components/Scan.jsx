import React, { useState } from "react";

const APP_TYPES = [
  { value: "web", label: "web/saas" },
  { value: "mobile", label: "mobile" },
  { value: "cli", label: "cli/oss" },
  { value: "extension", label: "extension" },
  { value: "game", label: "game" },
  { value: "other", label: "other" },
];

const STATES = ["developing", "operating", "maintenance", "sunset"];

export default function Scan({ status, onImported }) {
  const [mode, setMode] = useState("github");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState({}); // id -> overrides
  const [localPath, setLocalPath] = useState("~");
  const [importResult, setImportResult] = useState(null);

  const runScan = async () => {
    setLoading(true);
    setError(null);
    setCandidates([]);
    setSelected({});
    setImportResult(null);
    try {
      let result;
      if (mode === "github") {
        result = await fetch("/api/scan/github?limit=200").then((r) => r.json());
      } else {
        result = await fetch("/api/scan/local", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ basePath: localPath, maxDepth: 3 }),
        }).then((r) => r.json());
      }
      if (!result.ok) {
        setError(result.error || "スキャンに失敗しました");
      } else {
        setCandidates(normalizeCandidates(result.repos, mode));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id, defaults) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = { ...defaults };
      }
      return next;
    });
  };

  const updateField = (id, field, value) => {
    setSelected((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const runImport = async () => {
    const apps = candidates
      .filter((c) => selected[c.id])
      .map((c) => ({
        id: c.id,
        name: selected[c.id].name || c.name,
        state: selected[c.id].state || c.suggestedState || "developing",
        appType: selected[c.id].appType || "web",
        repoPath: c.path || null,
        github: c.url || c.remoteUrl || null,
        prodUrl: selected[c.id].prodUrl || null,
        description: c.description || "",
      }));

    if (apps.length === 0) {
      setError("インポートするアプリを1つ以上選んでください");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apps }),
      }).then((r) => r.json());

      if (!result.ok) {
        setError(result.error || "インポートに失敗しました");
      } else {
        setImportResult(result);
        setSelected({});
        if (onImported) onImported();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!status.available && (
        <div className="banner warn">
          <strong>.studio/ が見つかりません</strong>
          <p style={{ margin: "8px 0 0 0" }}>
            まず Claude Code で <code>/studio</code> を実行して初期化してください。
            その後このダッシュボードで一括インポートできます。
          </p>
        </div>
      )}

      <div className="card">
        <div className="section-title">スキャン元</div>
        <div className="row">
          <select
            className="select"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="github">GitHub（gh CLI 経由）</option>
            <option value="local">ローカルフォルダ</option>
          </select>
          {mode === "local" && (
            <input
              className="input"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="~/dev"
            />
          )}
          <button className="btn primary" onClick={runScan} disabled={loading}>
            {loading ? "スキャン中..." : "スキャン実行"}
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {importResult && (
        <div className="banner">
          {importResult.results.length}件のインポートを完了:
          <ul style={{ margin: "8px 0 0 16px" }}>
            {importResult.results.map((r) => (
              <li key={r.id}>
                {r.ok ? "✓" : "✗"} {r.id} {r.error ? `(${r.error})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidates.length > 0 && (
        <>
          <div className="row" style={{ margin: "8px 0 16px 0" }}>
            <div className="dim">
              {candidates.length}件発見 / 選択中{" "}
              {Object.keys(selected).length}件
            </div>
            <button
              className="btn primary"
              disabled={loading || Object.keys(selected).length === 0 || !status.available}
              onClick={runImport}
            >
              選択中をインポート
            </button>
          </div>

          <div className="card scan-table" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>name</th>
                  <th>言語</th>
                  <th>最終更新</th>
                  <th>state（推定）</th>
                  <th>type</th>
                  <th>説明</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const isSelected = !!selected[c.id];
                  const overrides = selected[c.id] || {};
                  return (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            toggle(c.id, {
                              name: c.name,
                              state: c.suggestedState || "developing",
                              appType: "web",
                            })
                          }
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.name}</div>
                        {(c.url || c.remoteUrl || c.path) && (
                          <div
                            className="dim"
                            style={{ fontSize: 11, fontFamily: "monospace" }}
                          >
                            {c.url || c.remoteUrl || c.path}
                          </div>
                        )}
                      </td>
                      <td className="dim">{c.language || "-"}</td>
                      <td className="dim">
                        {formatDate(c.updatedAt || c.lastCommit)}
                      </td>
                      <td>
                        {isSelected ? (
                          <select
                            className="select"
                            value={overrides.state}
                            onChange={(e) =>
                              updateField(c.id, "state", e.target.value)
                            }
                          >
                            {STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`badge ${c.suggestedState}`}>
                            {c.suggestedState}
                          </span>
                        )}
                      </td>
                      <td>
                        {isSelected ? (
                          <select
                            className="select"
                            value={overrides.appType}
                            onChange={(e) =>
                              updateField(c.id, "appType", e.target.value)
                            }
                          >
                            {APP_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="dim">-</span>
                        )}
                      </td>
                      <td className="dim" style={{ maxWidth: 320 }}>
                        {c.description || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function normalizeCandidates(repos, mode) {
  return repos.map((r) => ({
    id: r.id || r.name,
    name: r.name,
    description: r.description || "",
    url: r.url,
    remoteUrl: r.remoteUrl,
    path: r.path,
    language: r.language,
    updatedAt: r.updatedAt,
    lastCommit: r.lastCommit,
    suggestedState: r.suggestedState || "developing",
    source: mode,
  }));
}

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  const today = new Date();
  const days = Math.floor((today - d) / 86400000);
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 30) return `${days}日前`;
  if (days < 365) return `${Math.floor(days / 30)}ヶ月前`;
  return `${Math.floor(days / 365)}年前`;
}
