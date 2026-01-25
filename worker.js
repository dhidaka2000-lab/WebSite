export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ★ あなたの GAS Web アプリ URL（デプロイ時の URL）
    const gasUrl =
      "https://script.google.com/macros/s/AKfycbw9ONyKBLAzL_DunjAjsUPAmUQ3E3W2wwAvDw88eL6blTxpHR5_w-fOCLoOW1hw7a3r/exec";

    // ★ クエリをそのまま GAS に転送
    const target = gasUrl + url.search;

    // ★ GAS にリクエスト
    const gasResponse = await fetch(target, {
      method: "GET",
    });

    const body = await gasResponse.text();

    // ★ CORS ヘッダーを Worker が付けて返す
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }
};