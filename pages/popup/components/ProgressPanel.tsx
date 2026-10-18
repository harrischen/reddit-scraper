/**
 * 抓取 / 分析进行中的进度面板
 * AI 分析阶段：把所有子步骤竖列，每步前用图标标记状态
 *   ✓ 已完成 / ● 进行中（脉冲）/ ○ 待处理；批次进度由下方进度条 + 计数体现
 */

interface Props {
  progress: string;
  analyzing: boolean;
  phase?: "extract" | "aggregate";
  batch?: number;
  batches?: number;
}

type StepKey = "extract" | "aggregate";
type StepStatus = "done" | "active" | "pending";

const AI_STEPS: Array<{ key: StepKey; label: string }> = [
  { key: "extract", label: "抽取需求" },
  { key: "aggregate", label: "聚合打分" },
];

export function ProgressPanel({ progress, analyzing, phase, batch = 0, batches = 0 }: Props) {
  if (analyzing) {
    return (
      <div className="rv-app" data-theme="light">
        <div className="rv-progress">
          <div className="rv-progress-stage">AI 分析中</div>

          <ul className="rv-steps">
            {AI_STEPS.map((s) => {
              const status: StepStatus =
                s.key === phase
                  ? "active"
                  : phase === "aggregate" && s.key === "extract"
                    ? "done"
                    : "pending";
              return (
                <li key={s.key} className={`rv-step-item ${status}`}>
                  <span className="rv-step-dot">
                    {status === "done" ? "✓" : status === "active" ? "●" : "○"}
                  </span>
                  <span className="rv-step-name">{s.label}</span>
                </li>
              );
            })}
          </ul>

          <div className="rv-progress-bar-row">
            <div className="rv-progress-bar">
              <div className="rv-progress-fill" />
            </div>
            {phase === "extract" && batches > 0 && (
              <span className="rv-progress-count">
                {batch}/{batches} 批
              </span>
            )}
          </div>
          <p className="rv-empty-note">
            长任务请保持本页打开（抓取约 5-8 分钟，AI 分析视批次数量而定），关闭页面将丢失本次进度。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rv-app" data-theme="light">
      <div className="rv-progress">
        <div className="rv-progress-stage">数据抓取中</div>
        <div className="rv-progress-bar">
          <div className="rv-progress-fill" />
        </div>
        <div className="rv-progress-text">{progress || "正在准备…"}</div>
        <p className="rv-empty-note">
          长任务请保持本页打开（抓取约 5-8 分钟，AI 分析视批次数量而定），关闭页面将丢失本次进度。
        </p>
      </div>
    </div>
  );
}
