export default {
  async fetch(request) {
    const url = new URL(request.url);

    const gasUrl = "https://script.google.com/macros/s/AKfycbw9ONyKBLAzL_DunjAjsUPAmUQ3E3W2wwAvDw88eL6blTxpHR5_w-fOCLoOW1hw7a3r/exec";

    const target = gasUrl + url.search;

    const gasResponse = await fetch(target);
    const body = await gasResponse.text();

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