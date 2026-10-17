/**
 * 全局类型定义
 *
 * 分三块：
 * 1. Reddit 数据模型（帖子 / 评论，评论带 permalink 用于溯源）
 * 2. 抓取与 API 配置
 * 3. VOC 报告模型 v3（需求信号 + 机会分排序的选品决策看板）
 *
 * 防幻觉设计：
 * - permalink / freq / opportunity / metrics 一律由前端从原始数据生成，AI 不产出
 * - AI 只做「分类 + 聚类 + 打分 + verbatim 摘录 + 翻译」，摘录不合法时前端丢弃
 */

/** 一条评论（评论接口抓取、递归展开评论树后得到） */
export interface RedditComment {
  id: string;
  author: string;
  score: number; // 点赞数
  body: string; // 评论正文
  depth: number; // 嵌套层级，0 为顶层
  permalink: string; // 评论完整链接，用于证据溯源
}

/** 一篇帖子（列表接口返回 + 追加抓取的评论） */
export interface RedditPostRow {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  score: number;
  upvote_ratio: number;
  num_comments: number; // 该帖评论总数（仅数量）
  created_utc: string;
  permalink: string; // 帖子链接
  url: string; // 外链
  selftext: string; // 正文
  link_flair_text: string;
  is_self: boolean;
  over_18: boolean;
  comments: RedditComment[];
}

/** 抓取排序方式 */
export type Mode = "new" | "hot" | "rising" | "search";

/** 列表抓取参数 */
export interface FetchParams {
  subreddit: string;
  mode: Mode;
  keyword: string;
}

/** AI 服务连接配置（OpenAI 兼容接口） */
export interface ApiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** 预设 AI 服务商：baseUrl 与可用 model 关联，供 AI 设置下拉选择 */
export interface ProviderPreset {
  name: string;
  baseUrl: string;
  models: string[];
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-reasoner"] },
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1"] },
  { name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"] },
  { name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen-turbo", "qwen-plus", "qwen-max"] },
  { name: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-4-flash", "glm-4"] },
];

/** 一次完整抓取任务配置 */
export interface TaskConfig extends FetchParams {
  limit: number;
  maxComments: number;
}

// ===== VOC 报告模型 v3（需求信号 + 机会分看板） =====

/**
 * 一条证据引文（三要素：英文原话 + 中文翻译 + 来源链接）。
 * quote_en/quote_zh 由 AI 摘录翻译（前端校验子串防编造），
 * permalink 由前端从原始数据回链，保证链接真实、可点击跳转。
 */
export interface SignalQuote {
  quote_en: string; // 英文原话（verbatim 摘录）
  quote_zh: string; // 中文翻译
  permalink: string; // 帖子或评论完整链接（前端生成）
  source_type: "post" | "comment";
  score: number; // 点赞数，展示热度辅助
}

/** 情绪（用于判断需求强度） */
export type Emotion = "negative" | "mixed" | "positive";

/** 一条需求信号（聚类后的独立需求 + AI 打分 + 证据） */
export interface Signal {
  id: string; // 前端生成 S1/S2…，按机会分降序
  name: string; // 需求名称（中文）
  freq: number; // 提及频次（前端算：有效 post_ids 去重）
  importance: number; // 重要性 0-10（AI 打分）
  satisfaction: number; // 现有方案满意度 0-10（AI 打分，越低=越凑合）
  willingness: string; // 付费意愿（AI：高/中高/中/低）
  current: string; // 现有解决办法（AI）
  flaw: string; // 现有方案缺陷（AI）
  competition: string; // 竞争度（AI：低/中/高）
  angle: string; // 切入角度（AI）
  emotion: Emotion;
  opportunity: number; // 机会分 0-20（前端算：importance + max(importance − satisfaction, 0)）
  quotes: SignalQuote[]; // 证据原话（可回查）
  cur_quotes: SignalQuote[]; // 对现有方案不满的原话
}

/** 看板顶部指标 */
export interface VocMetrics {
  scraped: number; // 抓取样本（帖子 + 评论原始量）
  valid: number; // 有效样本（被引用到的独立帖子数）
  signals: number; // 需求信号数
  top_opportunities: number; // 高机会需求（机会分 ≥ 12）
}

/** 最终 VOC 报告 v3 */
export interface VocReport {
  version: 3;
  category: string; // 品类（subreddit 或 keyword）
  market: string; // 目标市场
  platform: string; // 数据源
  generated_at: string;
  metrics: VocMetrics;
  signals: Signal[]; // 已按机会分降序
}

/** 机会分公式常量 */
export const OPPORTUNITY_THRESHOLD = 12; // 高机会需求阈值
