/**
 * 需求信号面板：按机会分降序展示信号卡片列表
 * 排序已在报告生成时完成（机会分是唯一排序依据），无需额外排序控件。
 */

import type { Signal } from "@/src/types";
import { SignalCard } from "./SignalCard";

export function SignalsPanel({ signals }: { signals: Signal[] }) {
  return (
    <div className="rv-panel">
      {signals.map((s) => (
        <SignalCard key={s.id} signal={s} />
      ))}
    </div>
  );
}
