import { NextResponse } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const ADMIN_COOKIE = 'admin_auth';

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  let token = '';

  if (contentType.includes('application/json')) {
    const body = await request.json();
    token = String(body?.token ?? '');
  } else {
    const form = await request.formData();
    token = String(form.get('token') ?? '');
  }

  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const response = NextResponse.redirect(new URL('/admin', request.url));
  response.cookies.set(ADMIN_COOKIE, ADMIN_TOKEN, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
