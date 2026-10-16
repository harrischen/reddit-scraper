/**
 * 左侧表单区：AI 设置 + 抓取参数 + 开始分析按钮 + 状态栏
 * 弹窗形态下即全部内容；标签页形态下是左栏。
 */

import type { ApiSettings, Mode, TaskConfig } from "@/src/types";

interface Props {
  api: ApiSettings;
  task: TaskConfig;
  onApiChange: (next: ApiSettings) => void;
  onTaskChange: (next: TaskConfig) => void;
  onAnalyze: () => void;
  ready: boolean;
  status: string;
  running: boolean;
  isTab: boolean;
}

export default function Sidebar({
  api,
  task,
  onApiChange,
  onTaskChange,
  onAnalyze,
  ready,
  status,
  running,
  isTab,
}: Props) {
  return (
    <div className="sidebar">
      <div className="toolbar">
        <h1>Reddit 数据抓取</h1>
        {!isTab && (
          <button
            className="open-tab"
            title="在独立标签页打开"
            onClick={() =>
              chrome.tabs.create({ url: chrome.runtime.getURL("pages/popup/popup.html?tab=1") })
            }
          >
            ↗
          </button>
        )}
      </div>

      {/* AI 设置区：失焦自动保存（App 的 onApiChange 里写入 storage） */}
      <details open>
        <summary>AI 设置（OpenAI 兼容接口）</summary>
        <label>
          Base URL
          <input
            type="text"
            placeholder="https://api.openai.com/v1"
            value={api.baseUrl}
            onChange={(e) => onApiChange({ ...api, baseUrl: e.target.value })}
          />
        </label>
        <label>
          API Key
          <input
            type="password"
            placeholder="sk-..."
            value={api.apiKey}
            onChange={(e) => onApiChange({ ...api, apiKey: e.target.value })}
          />
        </label>
        <label>
          模型
          <input
            type="text"
            placeholder="gpt-4o-mini"
            value={api.model}
            onChange={(e) => onApiChange({ ...api, model: e.target.value })}
          />
        </label>
      </details>

      <label>
        子版名（不含 r/，关键词全站搜索时可留空）
        <input
          type="text"
          placeholder="例如 HomeDecorating"
          value={task.subreddit}
          onChange={(e) => onTaskChange({ ...task, subreddit: e.target.value })}
        />
      </label>

      <label>
        排序 / 模式
        <select
          value={task.mode}
          onChange={(e) => onTaskChange({ ...task, mode: e.target.value as Mode })}
        >
          <option value="new">最新 new</option>
          <option value="hot">热门 hot</option>
          <option value="rising">上升 rising</option>
          <option value="search">关键词搜索</option>
        </select>
      </label>

      {/* 仅「关键词搜索」模式显示 */}
      {task.mode === "search" && (
        <label>
          关键词
          <input
            type="text"
            placeholder="例如 storage bin"
            value={task.keyword}
            onChange={(e) => onTaskChange({ ...task, keyword: e.target.value })}
          />
        </label>
      )}

      <label>
        帖子数量（默认 50，最多 500）
        <input
          type="number"
          min={1}
          max={500}
          value={task.limit}
          onChange={(e) =>
            onTaskChange({
              ...task,
              limit: Math.min(Math.max(parseInt(e.target.value, 10) || 50, 1), 500),
            })
          }
        />
      </label>

      <label>
        每帖评论上限（默认 500，评论是 VOC 分析的核心）
        <input
          type="number"
          min={1}
          max={1000}
          value={task.maxComments}
          onChange={(e) =>
            onTaskChange({
              ...task,
              maxComments: Math.min(Math.max(parseInt(e.target.value, 10) || 500, 1), 1000),
            })
          }
        />
      </label>

      <button onClick={onAnalyze} disabled={!ready || running}>
        {running ? "分析中…" : "开始分析"}
      </button>

      <div id="status">{status}</div>
    </div>
  );
}
