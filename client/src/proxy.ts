/**
 * proxy.ts — Next.js 16 proxy (replaces middleware.ts).
 *
 * This file is reserved by the framework. We export a passthrough function
 * so Next.js is satisfied, but no request interception is needed here.
 *
 * Routing is handled at the infrastructure layer:
 *   Production : NGINX routes /api/* → Express :4000 and /ai/* → Flask :5001
 *   Development: next.config.ts rewrites proxy /api and /ai to local services
 */
import { type NextRequest, NextResponse } from 'next/server';

export function proxy(_request: NextRequest) {
  return NextResponse.next();
}
