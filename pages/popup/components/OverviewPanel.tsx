/**
 * 总览面板：机会分横向柱状图 + 策略说明（机会分公式）
 */

import type { Signal } from "@/src/types";
import { opportunityColor } from "./ScoreBadge";

function HBar({ signal }: { signal: Signal }) {
  const pct = Math.round((signal.opportunity / 20) * 100);
  return (
    <div className="rv-hbar-row">
      <div className="rv-hbar-main">
        <div className="rv-hbar-track">
          <div
            className="rv-hbar-fill"
            style={{ width: `${pct}%`, background: opportunityColor(signal.opportunity) }}
          />
        </div>
        <div className="rv-hbar-score">{signal.opportunity}</div>
        <div className="rv-hbar-meta">
          重要 {signal.importance} · 满意 {signal.satisfaction}
        </div>
      </div>
      <div className="rv-hbar-label">{signal.name}</div>
    </div>
  );
}

export function OverviewPanel({ signals }: { signals: Signal[] }) {
  const sorted = [...signals].sort((a, b) => b.opportunity - a.opportunity);
  return (
    <div className="rv-panel">
      <div className="rv-card">
        <h2 className="rv-section-title">需求机会分排序（横向柱状图）</h2>
        <div className="rv-legend">
          条形长度 = 机会分（0–20）· 红 = 高机会 · 琥珀 = 中 · 蓝 = 低
        </div>
        {sorted.map((s) => (
          <HBar key={s.id} signal={s} />
        ))}
      </div>

      <div className="rv-card">
        <h2 className="rv-section-title">策略说明</h2>
        <div className="rv-formula">
          机会分 <code>Opportunity = Importance + max(Importance − Satisfaction, 0)</code>
        </div>
        <p className="rv-para">
          这是 Outcome-Driven Innovation（Ulwick）的机会分公式：重要性高但现有方案满意度低的需求，才是真正值得切入的"未被满足的市场"。它解决了"只看频次、没有优先级"的问题——频次高不等于值得做，关键是"用户痛 + 没人解决得好"。
        </p>
      </div>
    </div>
  );
}
