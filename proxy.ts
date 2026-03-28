import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/uploads/")) {
    return new NextResponse("Gone", {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, noarchive",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/uploads/:path*"],
};
