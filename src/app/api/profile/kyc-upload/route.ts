import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const userId = String(formData.get('user_id') ?? '').trim();
  const documentType = String(formData.get('document_type') ?? '').trim();
  const file = formData.get('file');

  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const name = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'document';
  const extension = name.includes('.') ? name.split('.').pop() : 'bin';
  const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
  const path = `${userId}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabaseAdmin.storage.from('kyc').upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }

  const { data: publicData } = supabaseAdmin.storage.from('kyc').getPublicUrl(path);

  return NextResponse.json({
    path,
    publicUrl: publicData?.publicUrl ?? null,
    document_type: documentType || null,
  });
}
