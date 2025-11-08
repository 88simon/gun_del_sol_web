// Auth disabled for development - Gun Del Sol doesn't need authentication for local use
import { NextRequest, NextResponse } from 'next/server';

export default function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};
