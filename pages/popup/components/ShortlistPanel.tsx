/**
 * 选品短名单面板：机会分 Top 3 + 切入角度
 */

import type { Signal } from "@/src/types";
import { ScoreBadge } from "./ScoreBadge";

export function ShortlistPanel({ signals }: { signals: Signal[] }) {
  const top = [...signals].sort((a, b) => b.opportunity - a.opportunity).slice(0, 3);
  return (
    <div className="rv-panel">
      <div className="rv-card">
        <h2 className="rv-section-title">选品短名单（机会分 Top 3）</h2>
        {top.map((s, i) => (
          <div className="rv-signal-card" key={s.id}>
            <div className="rv-signal-head">
              <div className="rv-signal-name">
                {i + 1}. {s.name}
              </div>
              <ScoreBadge value={s.opportunity} />
            </div>
            <div className="rv-signal-grid">
              <div className="rv-signal-cell">
                <div className="rv-signal-k">需求依据</div>
                <div className="rv-signal-v">提及 {s.freq} 次 · 付费意愿 {s.willingness}</div>
              </div>
              <div className="rv-signal-cell">
                <div className="rv-signal-k">现有方案缺陷</div>
                <div className="rv-signal-v">满意度 {s.satisfaction}/10</div>
              </div>
              <div className="rv-signal-cell">
                <div className="rv-signal-k">竞争度</div>
                <div className="rv-signal-v">{s.competition}</div>
              </div>
              <div className="rv-signal-cell">
                <div className="rv-signal-k">切入角度</div>
                <div className="rv-signal-v">{s.angle || "—"}</div>
              </div>
            </div>
          </div>
        ))}
        <p className="rv-para muted">
          短名单判定标准：机会分优先（需求强 + 未被满足），辅以竞争度与付费意愿交叉验证。真实选品还需叠加市场容量、客单价、供应链与合规。
        </p>
      </div>
    </div>
  );
}
