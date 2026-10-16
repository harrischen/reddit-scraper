/**
 * 需求信号卡片：一条完整的选品机会
 * 结构：需求名 + 机会分 → 评分 grid（频次/重要性/满意度/付费意愿/竞争度）
 *   → 现有办法（含缺陷）→ 切入角度 → 证据原话 → 对现有方案的不满
 */

import type { Signal } from "@/src/types";
import { ScoreBadge } from "./ScoreBadge";
import { Quote } from "./Quote";

export function SignalCard({ signal }: { signal: Signal }) {
  return (
    <div className="rv-signal-card">
      <div className="rv-signal-head">
        <div className="rv-signal-name">
          {signal.name}
          <span className="rv-signal-id">{signal.id}</span>
        </div>
        <ScoreBadge value={signal.opportunity} />
      </div>

      <div className="rv-signal-grid">
        <div className="rv-signal-cell">
          <div className="rv-signal-k">提及频次</div>
          <div className="rv-signal-v">{signal.freq} 次</div>
        </div>
        <div className="rv-signal-cell">
          <div className="rv-signal-k">重要性</div>
          <div className="rv-signal-v">{signal.importance} / 10</div>
        </div>
        <div className="rv-signal-cell">
          <div className="rv-signal-k">现有方案满意度</div>
          <div className="rv-signal-v">{signal.satisfaction} / 10</div>
        </div>
        <div className="rv-signal-cell">
          <div className="rv-signal-k">付费意愿</div>
          <div className="rv-signal-v">{signal.willingness}</div>
        </div>
        <div className="rv-signal-cell">
          <div className="rv-signal-k">竞争度</div>
          <div className="rv-signal-v">{signal.competition}</div>
        </div>
      </div>

      {signal.current && (
        <div className="rv-signal-line">
          <span className="rv-line-k">现有办法</span>
          <span className="rv-line-v">{signal.current}</span>
          {signal.flaw && <span className="rv-line-flaw">缺陷：{signal.flaw}</span>}
        </div>
      )}

      {signal.angle && (
        <div className="rv-signal-angle">
          <span className="rv-line-k">切入角度</span>
          <span className="rv-line-v">{signal.angle}</span>
        </div>
      )}

      {signal.quotes.length > 0 && <div className="rv-quote-head">证据原话（可回查）</div>}
      {signal.quotes.map((q, i) => (
        <Quote key={i} q={q} />
      ))}

      {signal.cur_quotes.length > 0 && (
        <div className="rv-quote-head">对现有方案的不满</div>
      )}
      {signal.cur_quotes.map((q, i) => (
        <Quote key={i} q={q} />
      ))}
    </div>
  );
}
