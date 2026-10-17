/**
 * 抓取 / 分析进行中的进度面板：当前阶段 + 进度文字
 */

interface Props {
  progress: string;
  analyzing: boolean;
}

export function ProgressPanel({ progress, analyzing }: Props) {
  return (
    <div className="rv-app" data-theme="light">
      <div className="rv-progress">
        <div className="rv-progress-stage">{analyzing ? "AI 分析中" : "数据抓取中"}</div>
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
