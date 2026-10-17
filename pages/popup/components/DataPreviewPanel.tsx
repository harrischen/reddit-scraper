/**
 * 步骤2：数据预览面板
 * 统计行（x 帖 y 评论）+ 关键词过滤 + 帖子卡片列表（可展开评论）+ CSV 下载
 * 数据来源是已落盘的抓取结果；「开始 AI 分析」由左侧（AI 设置区下方）触发。
 */

import { useMemo, useState } from "react";
import { downloadFile, filePrefix } from "@/src/utils/download";
import { toPostsCsv, toCommentsCsv } from "@/src/utils/csv";
import type { RedditPostRow, TaskConfig } from "@/src/types";
import { PostCard } from "./PostCard";

interface Props {
  posts: RedditPostRow[];
  task: TaskConfig;
}

export default function DataPreviewPanel({ posts, task }: Props) {
  const [filter, setFilter] = useState("");
  const [toast, setToast] = useState("");

  const totalComments = useMemo(
    () => posts.reduce((sum, p) => sum + p.comments.length, 0),
    [posts]
  );

  const filtered = useMemo(() => {
    const kw = filter.trim().toLowerCase();
    if (!kw) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(kw) ||
        p.selftext.toLowerCase().includes(kw) ||
        p.comments.some((c) => c.body.toLowerCase().includes(kw))
    );
  }, [posts, filter]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const downloadCsv = () => {
    const prefix = filePrefix(task);
    downloadFile(`${prefix}_posts.csv`, toPostsCsv(posts), "text/csv");
    downloadFile(`${prefix}_comments.csv`, toCommentsCsv(posts), "text/csv");
    notify("已下载原始 CSV（posts + comments）");
  };

  return (
    <div className="rv-app" data-theme="light">
      <div className="rv-preview-head">
        <div>
          <h1 className="rv-h1">数据预览</h1>
          <div className="rv-header-sub">
            确认数据质量后，在左侧填好 AI 设置并点「开始 AI 分析」（可先下载 CSV 用外部工具检查）
          </div>
        </div>
      </div>

      <div className="rv-metrics rv-metrics-3">
        <div className="rv-metric">
          <div className="rv-metric-label">帖子</div>
          <div className="rv-metric-value">{posts.length}</div>
          <div className="rv-metric-hint">{filtered.length} 篇符合当前过滤</div>
        </div>
        <div className="rv-metric">
          <div className="rv-metric-label">评论</div>
          <div className="rv-metric-value">{totalComments}</div>
          <div className="rv-metric-hint">VOC 分析的核心语料</div>
        </div>
        <div className="rv-metric">
          <div className="rv-metric-label">操作</div>
          <button className="rv-cta rv-cta-ghost" onClick={downloadCsv}>
            下载原始 CSV
          </button>
          <div className="rv-metric-hint">{toast || "posts + comments 两份"}</div>
        </div>
      </div>

      <input
        className="rv-filter"
        type="search"
        placeholder="过滤：标题 / 正文 / 评论包含的关键词…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="rv-post-list">
        {filtered.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        {filtered.length === 0 && <p className="rv-empty-note">没有符合「{filter}」的帖子</p>}
      </div>
    </div>
  );
}
