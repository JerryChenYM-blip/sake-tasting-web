/**
 * ========================================================
 * 清酒試飲會 - 前端訂單送出 helper
 * ========================================================
 *
 * 用法：
 *   1. 在 HTML 中 <script src="frontend_integration.js"></script>
 *   2. 設定 endpoint:
 *        window.SAKE_ORDER_ENDPOINT = "https://script.google.com/macros/s/AKfy.../exec";
 *   3. 收集表單資料後呼叫:
 *        submitOrder(orderData).then(...)
 */

// ⬇️  部署 Apps Script Web App 後，把 URL 貼到這裡 ⬇️
window.SAKE_ORDER_ENDPOINT = window.SAKE_ORDER_ENDPOINT || "PASTE_YOUR_WEB_APP_URL_HERE";

/**
 * 把訂單資料 POST 到後端。
 *
 * @param {Object} orderData  完整訂單 JSON（venue / evaluations / cart / motivations 等）
 * @returns {Promise<{status: string, orderId?: string, error?: string}>}
 *
 * 重要：
 *   - 使用 Content-Type: 'text/plain' 是為了避開 CORS preflight (OPTIONS)
 *     Apps Script Web App 不支援 OPTIONS preflight，
 *     用 text/plain 屬於 "simple request" 不會觸發 preflight。
 *   - 後端仍能用 JSON.parse(e.postData.contents) 正確解析。
 */
async function submitOrder(orderData) {
  const endpoint = window.SAKE_ORDER_ENDPOINT;

  if (!endpoint || endpoint === "PASTE_YOUR_WEB_APP_URL_HERE") {
    const err = "SAKE_ORDER_ENDPOINT 尚未設定";
    console.error(err);
    return { status: 'error', error: err };
  }

  // 補上前端時間戳（如果沒提供）
  if (!orderData.completedAt) {
    orderData.completedAt = new Date().toISOString();
  }

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      // 故意用 text/plain 避開 preflight；後端會自己 JSON.parse
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(orderData),
      redirect: 'follow'
    });

    if (!resp.ok) {
      return {
        status: 'error',
        error: 'HTTP ' + resp.status + ': ' + (await resp.text())
      };
    }

    const result = await resp.json();
    if (result.status === 'ok') {
      console.log('[訂單已送出] orderId:', result.orderId);
    } else {
      console.warn('[後端回報錯誤]', result.error);
    }
    return result;

  } catch (err) {
    console.error('[網路錯誤]', err);
    return {
      status: 'error',
      error: err.message || String(err)
    };
  }
}

/**
 * 簡易 retry wrapper：網路失敗時自動重試 N 次。
 * 給現場活動用，避免 wifi 抖動就丟單。
 */
async function submitOrderWithRetry(orderData, maxRetries = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await submitOrder(orderData);
    if (result.status === 'ok') return result;
    lastError = result.error;
    console.warn(`[嘗試 ${attempt}/${maxRetries} 失敗]`, lastError);
    if (attempt < maxRetries) {
      // exponential backoff: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  return { status: 'error', error: 'All retries failed: ' + lastError };
}

// 暴露到 window 供 HTML 直接呼叫
window.submitOrder = submitOrder;
window.submitOrderWithRetry = submitOrderWithRetry;
