import { useState } from 'react';

function normalizeLink(text) {
  const match = text.trim().match(/https:\/\/[^\s]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    if (!['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname)) return null;
    if (!/^\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function ResultImage({ src }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return <div className="image-fallback"><span aria-hidden="true">🍳</span><p>이미지를 가져오지 못했어요</p></div>;
  }
  return <img className="result-image" src={src} alt="게시물 미리보기" onError={() => setError(true)} />;
}

export default function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const url = normalizeLink(input);
    if (!url) {
      setError('instagram.com/p/... 또는 instagram.com/reel/... 주소를 입력해 주세요.');
      setResult(null);
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '페이지를 가져올 수 없습니다.');
      setResult(data);
    } catch (err) {
      setError(err.message || '네트워크 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand"><div className="brand-icon">🍊</div><div>나의 레시피<span className="brand-sub">RECIPE ARCHIVE</span></div></div>
        <span className="test-pill">1단계 · 추출 테스트</span>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">MY LITTLE RECIPE BOX</div>
          <h1>맛있는 순간을<br /><em>잊지 않도록.</em></h1>
          <p>인스타그램에서 발견한 레시피, 링크 하나로 어디까지 가져올 수 있는지 먼저 확인해 봐요.</p>
        </section>
        <section className="form-card">
          <div className="section-heading"><div><span className="section-kicker">STEP 01</span><h2>인스타그램 링크 테스트</h2></div><div className="round-decoration">↗</div></div>
          <form onSubmit={handleSubmit}>
            <label htmlFor="link">게시물 또는 릴스 링크</label>
            <div className="input-wrap"><span aria-hidden="true">🔗</span><input id="link" value={input} onChange={e => setInput(e.target.value)} placeholder="https://www.instagram.com/p/..." autoComplete="off" /></div>
            <button type="submit" disabled={loading}>{loading ? '공개 게시물 확인 중…' : '썸네일과 글 가져오기'} <span aria-hidden="true">→</span></button>
          </form>
          {error && <div className="alert" role="alert"><strong>추출에 실패했어요.</strong><p>{error}</p><p>공개 게시물이라도 인스타그램이 자동 접근을 제한할 수 있어요.</p></div>}
        </section>
        {result && <section className="results" aria-live="polite">
          <div className="result-title"><span>추출 결과</span><span className="status-pill">확인 필요</span></div>
          <ResultImage key={result.url} src={result.image} />
          <div className="result-content">
            <h2>{result.title || '게시물 제목을 찾지 못했어요'}</h2>
            <div className="caption-block"><span className="field-title">본문 후보 · 구조화 데이터</span><p>{result.captionCandidate || '본문 후보를 찾지 못했어요. 웹사이트가 원문을 제공하지 않을 수 있어요.'}</p></div>
            <div className="caption-block pale"><span className="field-title">게시물 미리보기 설명 (원문 전체 아님)</span><p>{result.preview || '미리보기 설명이 없어요.'}</p></div>
            <p className="disclaimer">※ 글이 일부만 보이거나 이미지가 뜨지 않을 수 있어요. 이 버전은 데이터 추출 시험용이며 아직 저장 기능은 없어요.</p>
            <a className="source-link" href={result.url} target="_blank" rel="noopener noreferrer">인스타그램 원본 열기 ↗</a>
          </div>
        </section>}
        <section className="info-card"><div className="info-icon">✳</div><div><h3>이번 단계에서는 저장하지 않아요</h3><p>먼저 공개 게시물의 사진과 글이 실제로 얼마나 잘 추출되는지 테스트합니다. 성공률을 확인한 다음, Supabase 저장과 안드로이드 공유 기능을 추가할 거예요.</p></div></section>
      </main>
      <footer>개인용 레시피 프로젝트 · 외부 유료 API 없음</footer>
    </div>
  );
}
