/**
 * 文件下载工具
 */

import type { TaskConfig } from "@/src/types";

/** 触发浏览器下载一个文本文件（走 chrome.downloads，扩展权限内） */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: false }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
}

/** 下载文件名前缀：子版名 + 时间戳 */
export function filePrefix(task: Pick<TaskConfig, "subreddit" | "keyword">): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sub = task.subreddit.trim() || task.keyword.trim() || "search";
  return `reddit_${sub}_${stamp}`;
}
