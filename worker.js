export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const gasUrl =
      "https://script.google.com/macros/s/AKfycbw9ONyKBLAzL_DunjAjsUPAmUQ3E3W2wwAvDw88eL6blTxpHR5_w-fOCLoOW1hw7a3r/exec";

    const target = gasUrl + url.search;

    // GAS にリクエスト
    const gasResponse = await fetch(target);
    const body = await gasResponse.text();

    // ★★★ ここで GAS のレスポンスをログに出す ★★★
    console.log("GAS response status:", gasResponse.status);
    console.log("GAS response body:", body.substring(0, 500)); // 長すぎると困るので先頭だけ

    return new Response(body, {
      status: gasResponse.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }
};