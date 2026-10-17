/**
 * 请求防护：UA 池轮换（declarativeNetRequest session rule）
 *
 * 背景：Reddit 未登录 .json 端点限流约 10 次/分钟/IP，主要按 IP 计数。
 * UA 轮换是次要的指纹层防护，真正的防线是 reddit.ts 的间隔节流 + 429 退避。
 *
 * 技术约束：浏览器把 User-Agent 列为 forbidden header，页面 fetch 不能直接设置，
 * 必须走 chrome.declarativeNetRequest 的 session 规则改写请求头。
 *
 * ⚠️ 验证方式（spike）：安装扩展后在扩展页 console 执行
 *   await rotateUa(); fetch("https://httpbin.org/user-agent").then(r => r.json()).then(console.log)
 * 返回的 user-agent 应为池中 UA 而非浏览器真实 UA。若仍返回真实 UA（DNR 对
 * 扩展自身请求不生效），rotateUa 是无害空转，限流防护退化为纯节流 + 退避。
 */

const UA_RULE_ID = 1; // session 规则独立命名空间，固定 id 便于整体替换/移除

/** Chrome 桌面系 UA（Win/Mac/Edge），与真实浏览器流量混在一起才可信 */
const UA_POOL: string[] = [
  // Chrome 131 / Windows 10
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  // Chrome 131 / macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  // Edge 131 / Windows 10
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  // Chrome 130 / Windows 11
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
];

/** 随机选一个 UA 并写入 session 规则，reddit.com 的 xhr 请求头随之改变 */
export async function rotateUa(): Promise<void> {
  const ua = UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
  const dnr = chrome.declarativeNetRequest;
  await dnr.updateSessionRules({
    removeRuleIds: [UA_RULE_ID],
    addRules: [
      {
        id: UA_RULE_ID,
        priority: 1,
        condition: {
          urlFilter: "||reddit.com/",
          resourceTypes: [dnr.ResourceType.XMLHTTPREQUEST],
        },
        action: {
          type: dnr.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            { header: "User-Agent", operation: dnr.HeaderOperation.SET, value: ua },
          ],
        },
      },
    ],
  });
}

/** 移除 UA 规则（抓取结束后调用，让后续请求回归浏览器真实 UA） */
export async function clearUaRule(): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [UA_RULE_ID] });
}
