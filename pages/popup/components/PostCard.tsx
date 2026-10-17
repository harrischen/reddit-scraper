/**
 * 数据预览的单篇帖子卡片：标题 + 元信息，展开看正文与评论原文
 */

import type { RedditPostRow } from "@/src/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN");
}

export function PostCard({ post }: { post: RedditPostRow }) {
  return (
    <details className="rv-post-card">
      <summary>
        <span className="rv-post-title">{post.title}</span>
        <span className="rv-post-meta">
          {post.score} 赞 · {post.num_comments} 评论 · {formatDate(post.created_utc)}
        </span>
      </summary>
      <div className="rv-post-body">
        {post.selftext && <p className="rv-post-selftext">{post.selftext}</p>}
        {post.comments.length > 0 ? (
          <div className="rv-post-comments">
            <div className="rv-quote-head">评论原文（{post.comments.length} 条）</div>
            {post.comments.map((c) => (
              <div className="rv-comment" key={c.id}>
                <div className="rv-comment-meta">
                  <span className="rv-comment-author">{c.author}</span>
                  <span className="rv-comment-score">{c.score} 赞</span>
                  <a
                    className="rv-comment-src"
                    href={c.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    来源 ↗
                  </a>
                </div>
                <div className="rv-comment-body">{c.body}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rv-empty-note">该帖没有抓到评论</p>
        )}
        <p className="rv-post-link">
          <a href={post.permalink} target="_blank" rel="noopener noreferrer">
            打开原帖 ↗
          </a>
        </p>
      </div>
    </details>
  );
}
