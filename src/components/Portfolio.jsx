import React from "react";

export default function Portfolio({ status, dashboard }) {
  if (!status.available) {
    return (
      <div className="banner warn">
        <strong>.studio/ が見つかりません</strong>
        <p style={{ margin: "8px 0 0 0" }}>
          Claude Code で <code>/studio</code> を実行して初期化するか、
          Scan & Import タブから既存リポジトリをスキャンして取り込んでください。
        </p>
      </div>
    );
  }

  const apps = dashboard?.apps || [];
  const manager = dashboard?.manager || {};

  return (
    <>
      <ManagerCard manager={manager} />
      <h2 className="section-title">Apps ({apps.length})</h2>
      {apps.length === 0 ? (
        <div className="empty">
          まだアプリが登録されていません。
          <br />
          Scan & Import タブから取り込みましょう。
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>アプリ</th>
                <th>状態</th>
                <th>タイプ</th>
                <th>最終更新</th>
                <th>issues</th>
                <th>ideas</th>
                <th>feedback</th>
                <th>最新release</th>
                <th>リンク</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{app.name}</div>
                    {app.description && (
                      <div className="dim" style={{ fontSize: 12 }}>
                        {truncate(app.description, 80)}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${app.state}`}>{app.state}</span>
                  </td>
                  <td className="dim">{app.appType || "-"}</td>
                  <td className="dim">{formatDate(app.lastUpdated)}</td>
                  <td>
                    <Count n={app.openIssues} warn={app.openIssues >= 5} />
                  </td>
                  <td>
                    <Count n={app.openIdeas} />
                  </td>
                  <td>
                    <Count n={app.openFeedback} warn={app.openFeedback >= 3} />
                  </td>
                  <td className="dim">{app.latestRelease || "-"}</td>
                  <td>
                    {app.github && (
                      <a href={app.github} target="_blank" rel="noreferrer">
                        repo
                      </a>
                    )}
                    {app.github && app.prodUrl && " · "}
                    {app.prodUrl && (
                      <a href={app.prodUrl} target="_blank" rel="noreferrer">
                        live
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ManagerCard({ manager }) {
  if (!manager?.exists) return null;
  return (
    <div className="card">
      <div className="section-title">スタジオマネージャー</div>
      <div className="row" style={{ gap: 24 }}>
        <div>
          <div className="dim" style={{ fontSize: 12 }}>未完了 TODO</div>
          <div style={{ fontSize: 18 }}>{manager.openTodos ?? 0}</div>
        </div>
        <div>
          <div className="dim" style={{ fontSize: 12 }}>TODOs 最終更新</div>
          <div>{formatDate(manager.todosLatest)}</div>
        </div>
        <div>
          <div className="dim" style={{ fontSize: 12 }}>Inbox 最終更新</div>
          <div>{formatDate(manager.inboxLatest)}</div>
        </div>
        <div>
          <div className="dim" style={{ fontSize: 12 }}>Notes 最終更新</div>
          <div>{formatDate(manager.notesLatest)}</div>
        </div>
      </div>
    </div>
  );
}

function Count({ n, warn }) {
  return <span className={`count ${warn ? "warn" : ""}`}>{n ?? 0}</span>;
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
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
