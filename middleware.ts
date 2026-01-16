import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const ADMIN_USER = 'admin';
const ADMIN_COOKIE = 'admin_auth';

function unauthorized() {
  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin"',
    },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/admin/login')) {
    return NextResponse.next();
  }

  if (!ADMIN_TOKEN) {
    return unauthorized();
  }

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value ?? '';
  if (cookie && cookie === ADMIN_TOKEN) {
    return NextResponse.next();
  }

  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Basic ')) {
    return unauthorized();
  }

  const encoded = auth.slice(6).trim();
  let decoded = '';
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return unauthorized();
  }

  const [user, pass] = decoded.split(':');
  if (user !== ADMIN_USER || pass !== ADMIN_TOKEN) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*'],
};
