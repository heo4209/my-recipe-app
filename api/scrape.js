import * as cheerio from 'cheerio';

const HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
const MAX_HTML_BYTES = 2_000_000;

function canonicalInstagramUrl(input) {
  if (typeof input !== 'string' || input.length > 3000) return null;
  try {
    const parsed = new URL(input);
    const match = parsed.pathname.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)\/?$/);
    if (parsed.protocol !== 'https:' || !HOSTS.has(parsed.hostname) || !match) return null;
    return `https://www.instagram.com/${match[1]}/${match[2]}/`;
  } catch {
    return null;
  }
}

function walkForCaption(node, depth = 0) {
  if (depth > 4 || node == null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = walkForCaption(child, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  for (const key of ['articleBody', 'caption']) {
    if (typeof node[key] === 'string' && node[key].trim()) return node[key];
  }
  // description often holds a summary; deliberately do not mislabel it as a full caption.
  if (node['@graph']) return walkForCaption(node['@graph'], depth + 1);
  return null;
}

async function readBoundedHtml(response) {
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_HTML_BYTES) throw new Error('페이지가 너무 큽니다.');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let count = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > MAX_HTML_BYTES) throw new Error('페이지가 너무 큽니다.');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

// Vercel Node.js Function (Web Request/Response handler).
// This reads only anonymous, publicly accessible HTML: no accounts, cookies or bypasses.
export async function GET(request) {
  const input = new URL(request.url).searchParams.get('url');
  const url = canonicalInstagramUrl(input);
  if (!url) {
    return Response.json(
      { error: '인스타그램의 공개 게시물 또는 릴스 주소를 입력해 주세요.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/html', 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.6' },
      redirect: 'manual',
      signal: AbortSignal.timeout(9000),
    });
    if (res.status >= 300 && res.status < 400) {
      return Response.json({ url, error: '인스타그램이 다른 페이지로 이동을 요청해 추출을 중단했어요.' }, { status: 502 });
    }
    if (!res.ok) {
      return Response.json({ url, error: `공개 페이지 접근이 제한되었어요 (HTTP ${res.status}).` }, { status: 502 });
    }
    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html')) {
      return Response.json({ url, error: 'HTML 페이지를 받지 못했어요.' }, { status: 502 });
    }
    const html = await readBoundedHtml(res);
    const $ = cheerio.load(html);
    let captionCandidate = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (captionCandidate) return;
      try {
        captionCandidate = walkForCaption(JSON.parse($(el).html() || ''));
      } catch {
        // Some pages contain malformed JSON-LD. Ignore and continue.
      }
    });
    const image = $('meta[property="og:image"]').first().attr('content') || null;
    const preview = $('meta[property="og:description"]').first().attr('content')
      || $('meta[name="description"]').first().attr('content') || null;
    const title = $('meta[property="og:title"]').first().attr('content') || null;
    return Response.json({
      url,
      title,
      image,
      captionCandidate,
      preview,
      hasFullCaption: false,
      notice: '캡션 후보와 미리보기는 원문 전체와 다를 수 있어요. 저장 전 확인이 필요합니다.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({
      url,
      error: '공개 페이지를 읽지 못했어요. 인스타그램의 접근 제한 또는 네트워크 문제일 수 있습니다.',
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
