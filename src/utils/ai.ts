/**
 * AI 调用层：封装 OpenAI 兼容接口的 chat/completions 请求
 *
 * 不绑定具体厂商——只要提供 OpenAI 兼容的 /chat/completions 端点即可，
 * 兼容 OpenAI / DeepSeek / Moonshot / 通义等（在设置里填 baseUrl + key + model）。
 *
 * 结构化输出：
 * - response_format 可指定 json_schema（strict）/ json_object
 * - 厂商支持度参差：4xx 报错时自动降级（json_schema → json_object → 不带），
 *   探测结果在页面生命周期内缓存
 * - chatCompletionValidated：JSON.parse + zod 校验，失败把原因回喂重试
 */

import { ZodError } from "zod";
import type { ApiSettings } from "@/src/types";

/** 聊天消息（本插件用 system / user / assistant 三种角色，assistant 用于回喂重试） */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** OpenAI 兼容响应的最小类型（只取用到的字段） */
interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/** response_format 参数（与 OpenAI 规范对齐） */
export type ResponseFormat =
  | {
      type: "json_schema";
      json_schema: { name: string; strict: boolean; schema: Record<string, unknown> };
    }
  | { type: "json_object" };

/** 厂商对 response_format 的支持级别（本次页面生命周期内探测缓存） */
let formatSupport: "unknown" | "json_schema" | "json_object" | "none" = "unknown";

/** 重置探测缓存（测试用；正常流程无需调用） */
export function resetFormatSupport(): void {
  formatSupport = "unknown";
}

/**
 * 规范化 baseUrl：
 * - 去掉末尾多余的斜杠
 * - 若用户已填完整到 /chat/completions 则不重复拼接，否则补上
 */
function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

/** response_format 是否看起来不被支持（用于自动降级判断） */
function isFormatError(status: number, body: string): boolean {
  if (status < 400 || status >= 500) return false;
  return /response_format|json_schema|json_object|unknown field|unsupported/i.test(body);
}

/**
 * 发起一次 chat completion，返回模型输出的文本。
 * 传了 responseFormat 时带上 response_format 字段；若厂商不支持会自动降级重发。
 */
export async function chatCompletion(
  settings: ApiSettings,
  messages: ChatMessage[],
  responseFormat?: ResponseFormat
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error("请先在设置里填写 API Key");
  }

  const url = normalizeBaseUrl(settings.baseUrl);

  // 决定本次实际使用的 response_format（尊重已探测到的支持级别）
  let format = responseFormat;
  if (format) {
    if (formatSupport === "none") {
      format = undefined;
    } else if (formatSupport === "json_object" && format.type === "json_schema") {
      format = { type: "json_object" };
    }
  }

  const buildBody = (f?: ResponseFormat) =>
    JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.2, // 低温度，让分类/聚类输出更稳定、少发挥
      ...(f ? { response_format: f } : {}),
    });

  const send = async (f?: ResponseFormat) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: buildBody(f),
    });

  let res = await send(format);

  // 厂商不支持当前 response_format：逐级降级并缓存探测结果
  if (format && isFormatError(res.status, await res.clone().text().catch(() => ""))) {
    if (format.type === "json_schema") {
      formatSupport = formatSupport === "unknown" ? "json_object" : formatSupport;
      format = { type: "json_object" };
      res = await send(format);
      if (isFormatError(res.status, await res.clone().text().catch(() => ""))) {
        formatSupport = "none";
        format = undefined;
        res = await send(format);
      }
    } else {
      formatSupport = "none";
      format = undefined;
      res = await send(format);
    }
  } else if (format && formatSupport === "unknown") {
    formatSupport = format.type; // 探测成功，缓存
  }

  // 针对性错误提示，方便用户定位问题
  if (res.status === 401) {
    throw new Error("API Key 无效（401），请检查 Key 或 base URL");
  }
  if (res.status === 429) {
    throw new Error("触发 AI 服务限流（429），请稍后重试或更换模型");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI 请求失败（${res.status}）：${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as ChatCompletionResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI 返回内容为空");
  }
  return content;
}

/**
 * 从模型返回文本中提取 JSON，做容错：
 * 1. 去掉可能的 ```json ... ``` 代码块包裹
 * 2. 找到第一个 { 或 [ 作为 JSON 起点，最后一个对应闭合括号作为终点，
 *    兼容「裸对象」「裸数组」「前后带说明文字」三种情况
 */
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();

  const start = trimmed.search(/[{[]/);
  if (start === -1) return trimmed;

  const openChar = trimmed[start];
  const closeChar = openChar === "{" ? "}" : "]";
  const end = trimmed.lastIndexOf(closeChar);
  if (end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

/** 把 zod 校验失败摘要成短文本（前 3 条 issue），用于回喂重试 */
function summarizeIssues(error: ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

/**
 * 发起 chat completion 并解析 + 校验为 T。
 * schema 只要求带 parse 的最小结构（zod schema 直接兼容）。
 * - JSON.parse 或校验失败 → 把失败原因追加为 user 消息重试（最多 maxRetries 次）
 * - 全部失败则抛出带最后一次输出片段的友好错误
 */
export async function chatCompletionValidated<T>(
  settings: ApiSettings,
  messages: ChatMessage[],
  schema: { parse: (data: unknown) => T },
  responseFormat?: ResponseFormat,
  maxRetries = 2
): Promise<T> {
  const current = [...messages];
  let lastOutput = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastOutput = await chatCompletion(settings, current, responseFormat);
    try {
      const parsed = schema.parse(JSON.parse(extractJson(lastOutput)));
      return parsed;
    } catch (err) {
      const reason =
        err instanceof ZodError
          ? `未通过格式校验：${summarizeIssues(err)}`
          : "不是合法 JSON";
      if (attempt === maxRetries) break;
      current.push(
        { role: "assistant", content: lastOutput },
        { role: "user", content: `上一次输出${reason}。请只按 schema 返回完整 JSON，不要包含其他文字。` }
      );
    }
  }

  throw new Error(`AI 连续多次未返回合格 JSON，最后一次输出片段：${lastOutput.slice(0, 300)}`);
}
