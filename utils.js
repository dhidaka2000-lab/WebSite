export const ALLOWED_ORIGINS = [
  "https://dhidaka2000-lab.github.io",
  "https://dhidaka2000-lab.github.io/WebSite",
  "https://dhidaka2000-lab.github.io/Worker",
];

export function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(origin ? corsHeaders(origin) : {}),
      "Content-Type": "application/json",
    },
  });
}