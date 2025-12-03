import { NextResponse, NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const sessionId = req.cookies.get("sessionId")?.value;

  if (sessionId) {
    req.headers.set("x-session-id", sessionId);
  }

  return NextResponse.next();
}
