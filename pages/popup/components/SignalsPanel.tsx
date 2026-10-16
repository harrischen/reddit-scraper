/**
 * 需求信号面板：排序（机会分/频次/重要性）+ 信号卡片列表
 */

import { useState } from "react";
import type { Signal } from "@/src/types";
import { SignalCard } from "./SignalCard";

type SortKey = "opportunity" | "freq" | "importance";

export function SignalsPanel({ signals }: { signals: Signal[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("opportunity");
  const sorted = [...signals].sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <div className="rv-panel">
      <div className="rv-sort-bar">
        <span className="rv-sort-label">排序：</span>
        <button
          className={sortKey === "opportunity" ? "rv-sort-btn on" : "rv-sort-btn"}
          onClick={() => setSortKey("opportunity")}
        >
          按机会分
        </button>
        <button
          className={sortKey === "freq" ? "rv-sort-btn on" : "rv-sort-btn"}
          onClick={() => setSortKey("freq")}
        >
          按提及频次
        </button>
        <button
          className={sortKey === "importance" ? "rv-sort-btn on" : "rv-sort-btn"}
          onClick={() => setSortKey("importance")}
        >
          按重要性
        </button>
      </div>
      {sorted.map((s) => (
        <SignalCard key={s.id} signal={s} />
      ))}
    </div>
  );
}
