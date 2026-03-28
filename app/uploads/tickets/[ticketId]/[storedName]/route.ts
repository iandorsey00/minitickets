export async function GET(
  _request: Request,
) {
  return new Response("Gone", {
    status: 410,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, noarchive",
    },
  });
}
