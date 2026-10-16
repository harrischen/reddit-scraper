/**
 * 看板 tab 导航：总览 / 需求信号 / 现有解决办法 / 竞争格局 / 选品短名单
 */

export type TabKey = "overview" | "signals" | "competition" | "shortlist";

export const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "总览" },
  { key: "signals", label: "需求信号" },
  { key: "competition", label: "竞争格局" },
  { key: "shortlist", label: "选品短名单" },
];

interface Props {
  tab: TabKey;
  onTab: (t: TabKey) => void;
}

export function DashboardTabs({ tab, onTab }: Props) {
  return (
    <nav className="rv-tabs">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={tab === t.key ? "rv-tab active" : "rv-tab"}
          onClick={() => onTab(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
