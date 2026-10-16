/**
 * CSV 导出：把抓取的原始数据（帖子 + 评论）导出成 CSV 文件
 * 供「下载原始 CSV」使用——导出的是原始数据，不是分析报告。
 */

import type { RedditPostRow } from "@/src/types";

/** 转义 CSV 字段：含逗号/换行/双引号时用双引号包裹 */
function escapeCsvField(value: unknown): string {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** 帖子 CSV：每行一篇帖子（不含嵌套的评论数组） */
export function toPostsCsv(posts: RedditPostRow[]): string {
  const headers = [
    "id",
    "title",
    "author",
    "subreddit",
    "score",
    "upvote_ratio",
    "num_comments",
    "created_utc",
    "permalink",
    "url",
    "selftext",
    "link_flair_text",
    "is_self",
    "over_18",
  ] as const;

  const lines = [headers.join(",")];
  for (const p of posts) {
    lines.push(headers.map((h) => escapeCsvField(p[h])).join(","));
  }
  return lines.join("\n");
}

/** 评论 CSV：每行一条评论，带所属帖子信息，便于关联溯源 */
export function toCommentsCsv(posts: RedditPostRow[]): string {
  const headers = ["post_id", "post_title", "comment_id", "author", "score", "depth", "body", "permalink"];

  const lines = [headers.join(",")];
  for (const p of posts) {
    for (const c of p.comments) {
      lines.push(
        [p.id, p.title, c.id, c.author, c.score, c.depth, c.body, c.permalink]
          .map(escapeCsvField)
          .join(",")
      );
    }
  }
  return lines.join("\n");
}
