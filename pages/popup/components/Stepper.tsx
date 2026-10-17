/**
 * 步骤导航：① 配置 & 预览 → ② AI 报告
 * 只做两件事：高亮当前步；把「上一步」渲染为可点（onBack）。
 * 第 2 步只能通过「开始 AI 分析」到达，不提供向前跳。
 */

interface Props {
  current: 1 | 2;
  onBack?: () => void;
}

const STEPS: Array<{ n: 1 | 2; label: string }> = [
  { n: 1, label: "配置 & 预览" },
  { n: 2, label: "AI 报告" },
];

export function Stepper({ current, onBack }: Props) {
  return (
    <ol className="stepper">
      {STEPS.map(({ n, label }) => {
        const isPrev = n === current - 1;
        const action = isPrev ? onBack : undefined;
        const cls = n === current ? "step active" : n < current ? "step past" : "step";
        const inner = (
          <>
            <span className="step-num">{n < current ? "✓" : n}</span>
            <span className="step-label">{label}</span>
          </>
        );
        return (
          <li
            key={n}
            className={action ? `${cls} clickable` : cls}
            onClick={action}
            title={action ? `上一步：${label}` : undefined}
          >
            {inner}
          </li>
        );
      })}
    </ol>
  );
}
