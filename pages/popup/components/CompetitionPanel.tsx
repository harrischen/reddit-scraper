/**
 * 竞争格局面板：现有方案满意度对比条形图
 * 满意度越低 = 现有方案越"凑合" = 切入机会越大
 */

import type { Signal } from "@/src/types";

function satisfactionColor(v: number): string {
  if (v <= 3) return "var(--red)";
  if (v <= 4) return "var(--amber)";
  return "var(--green)";
}

export function CompetitionPanel({ signals }: { signals: Signal[] }) {
  const sorted = [...signals].sort((a, b) => a.satisfaction - b.satisfaction);
  return (
    <div className="rv-panel">
      <div className="rv-card">
        <h2 className="rv-section-title">现有方案满意度对比</h2>
        <p className="rv-para muted">满意度越低 = 现有方案越"凑合" = 切入机会越大</p>
        {sorted.map((s) => {
          const pct = s.satisfaction * 10;
          return (
            <div className="rv-bar-row" key={s.id}>
              <div className="rv-bar-main">
                <div className="rv-bar-track">
                  <div
                    className="rv-bar-fill"
                    style={{ width: `${pct}%`, background: satisfactionColor(s.satisfaction) }}
                  />
                </div>
                <div className="rv-bar-score">{s.satisfaction}</div>
                <div className="rv-bar-meta">/10 · {s.competition}竞争</div>
              </div>
              <div className="rv-bar-label">{s.name}</div>
              {(s.current || s.flaw) && (
                <div className="rv-bar-detail">
                  现有办法：{s.current || "—"}
                  {s.flaw && <span className="rv-bar-flaw">缺陷：{s.flaw}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
