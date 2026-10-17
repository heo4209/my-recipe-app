import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// Best-effort preservation of a public Instagram CDN thumbnail.
// This is a user-authenticated endpoint, with strict host / media / size checks.
const MAX_BYTES = 6 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function allowedImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return ['fbcdn.net', 'cdninstagram.com'].some(
      domain => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

async function boundedBuffer(response) {
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('사진이 너무 큽니다.');
  if (!response.body) throw new Error('이미지 본문이 없습니다.');
  const reader = response.body.getReader();
  let total = 0;
  const buffers = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error('사진이 너무 큽니다.');
      buffers.push(Buffer.from(value));
    }
    return Buffer.concat(buffers);
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request) {
  const noStore = { 'Cache-Control': 'no-store' };
  const bearer = request.headers.get('authorization') || '';
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  if (!token) return Response.json({ error: '로그인이 필요해요.' }, { status: 401, headers: noStore });
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ error: '서버 설정이 누락됐어요.' }, { status: 500, headers: noStore });

  try {
    const { recipeId } = await request.json();
    if (typeof recipeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(recipeId)) {
      return Response.json({ error: '잘못된 레시피 ID입니다.' }, { status: 400, headers: noStore });
    }

    const client = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) return Response.json({ error: '세션이 유효하지 않아요.' }, { status: 401, headers: noStore });
    const { data: recipe, error: readError } = await client.from('recipes')
      .select('id, image_url, image_path').eq('id', recipeId).single();
    if (readError || !recipe) return Response.json({ error: '레시피를 찾지 못했어요.' }, { status: 404, headers: noStore });
    if (recipe.image_path) return Response.json({ imagePath: recipe.image_path }, { headers: noStore });
    if (!allowedImageUrl(recipe.image_url)) {
      return Response.json({ error: '이 썸네일 주소는 자동 보관 대상이 아니에요.' }, { status: 422, headers: noStore });
    }

    const response = await fetch(recipe.image_url, {
      headers: { Accept: 'image/jpeg,image/png,image/webp' },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('사진을 가져올 수 없어요.');
    const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!TYPES[contentType]) throw new Error('지원하지 않는 사진 형식이에요.');
    const bytes = await boundedBuffer(response);
    const path = `${user.id}/${recipe.id}-${randomUUID()}.${TYPES[contentType]}`;
    const { error: uploadError } = await client.storage.from('recipe-images').upload(path, bytes, { contentType, upsert: false });
    if (uploadError) throw uploadError;
    const { error: updateError } = await client.from('recipes').update({ image_path: path }).eq('id', recipe.id);
    if (updateError) {
      await client.storage.from('recipe-images').remove([path]);
      throw updateError;
    }
    return Response.json({ imagePath: path }, { headers: noStore });
  } catch (error) {
    return Response.json({ error: error?.message || '사진 보관에 실패했어요.' }, { status: 422, headers: noStore });
  }
}
