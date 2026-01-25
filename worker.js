export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        }
      });
    }

    const body = await request.json();
    const idToken = request.headers.get("Authorization")?.replace("Bearer ", "");

    const gasUrl =
      "https://script.google.com/macros/s/AKfycbxV6HtICJkZfvzYYdAmIjnXHi9O_nC0RzTFoIr7Qp0f4cRQl-yfIogoOLSX3kHYdWCJxw/exec";
       
    const gasResponse = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        funcName: body.funcName,
        userName: body.userName,
        idToken: idToken
      })
    });

    const text = await gasResponse.text();

    return new Response(text, {
      status: gasResponse.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    });
  }
};