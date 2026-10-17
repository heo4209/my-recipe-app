import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase.js';

const CATEGORIES = ['미분류', '한식', '양식', '일식', '중식', '디저트', '기타'];


// Instagram preview metadata can prepend "2 likes, 3 comments -".
// Strip only that social-count label; leave the Instagram username and caption intact.
function removeInstagramCounts(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/^[ \t]*\d[\d,.]*[kKmMbB]?\s+likes?\s*,\s*\d[\d,.]*[kKmMbB]?\s+comments?\s*(?:[-–—|·:]\s*)?/i, '')
    .replace(/(^|\r?\n)[ \t]*\d[\d,.]*[kKmMbB]?\s+likes?\s*,\s*\d[\d,.]*[kKmMbB]?\s+comments?[ \t]*(?=\r?\n|$)/gim, '$1');
  return cleaned === value ? value : cleaned.trimStart();
}

function normalizeLink(text) {
  const match = (text || '').trim().match(/https:\/\/[^\s]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    if (!['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname)) return null;
    const post = url.pathname.match(/^\/(p|reel)\/([a-zA-Z0-9_-]+)\/?$/);
    return post ? `https://www.instagram.com/${post[1]}/${post[2]}/` : null;
  } catch {
    return null;
  }
}

// The Android OS sends URL/text/title query parameters to /share.
// Read them from the share landing page only, and keep the original URL out of storage until reviewed.
function sharedInstagramUrl() {
  if (window.location.pathname !== '/share') return null;
  const params = new URLSearchParams(window.location.search);
  return normalizeLink(
    [params.get('url'), params.get('text'), params.get('title')]
      .filter(Boolean).join(' ')
  );
}

function Cover({ src, alt = '레시피 사진', className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return <div className={`image-fallback ${className}`}><span aria-hidden="true">▤</span><small>사진 없음</small></div>;
  }
  return <img className={`result-image ${className}`} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function AuthScreen({ onMessage }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const credentials = { email: email.trim(), password };
      const { data, error: authError } = register
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);
      if (authError) throw authError;
      if (register && !data?.session) {
        onMessage('가입 요청을 완료했어요. 메일 인증 설정이 켜져 있다면 이메일을 확인한 다음 로그인해 주세요.');
        setRegister(false);
      } else if (register) {
        onMessage('계정을 만들었어요. 이제 내 보관함에 저장할 수 있어요.');
      }
    } catch (err) {
      setError(err.message || '계정을 확인하지 못했어요.');
    } finally {
      setPending(false);
    }
  }

  return <main className="auth-container">
    <div className="hero auth-hero"><div className="eyebrow">PERSONAL ARCHIVE</div><h1>레시피 아카이브</h1></div>
    <section className="form-card auth-card">
      <div className="section-kicker">ACCOUNT</div>
      <h2>{register ? '처음 사용할 계정 만들기' : '로그인'}</h2>
      <form onSubmit={submit}>
        <label htmlFor="email">이메일</label>
        <div className="input-wrap"><input id="email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></div>
        <label htmlFor="password" className="field-top">비밀번호</label>
        <div className="input-wrap"><input id="password" type="password" minLength="6" required autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="6자 이상" /></div>
        <button type="submit" disabled={pending}>{pending ? '처리 중…' : register ? '계정 만들기' : '로그인'} →</button>
      </form>
      {error && <p className="alert" role="alert">{error}</p>}
      <button className="text-button" type="button" onClick={() => { setRegister(!register); setError(''); }}>{register ? '이미 계정이 있어요 · 로그인' : '처음이라면 계정 만들기'}</button>

    </section>
  </main>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('add');
  const [input, setInput] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCaption, setDraftCaption] = useState('');
  const [draftCategory, setDraftCategory] = useState('미분류');
  const [imageFile, setImageFile] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('전체');
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editCategory, setEditCategory] = useState('미분류');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    }).catch(() => setAuthReady(true));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.id) loadRecipes(user.id);
    else { setRecipes([]); setSelectedId(null); }
  }, [user?.id]);

  // An installed Android PWA can receive a post from Instagram Share -> More.
  // If signed out, keep /share query intact until login completes; never auto-save unreviewed content.
  useEffect(() => {
    if (!user?.id || window.location.pathname !== '/share') return;
    const link = sharedInstagramUrl();
    window.history.replaceState(window.history.state, '', '/');
    setActiveTab('add');
    if (!link) {
      setError('공유된 인스타그램 게시물 주소를 찾지 못했어요. 일반 공개 게시물 링크를 공유해 주세요.');
      return;
    }
    setInput(link);
    void extractFromUrl(link);
  }, [user?.id]);

  async function loadRecipes(ownerId) {
    setLoadingRecipes(true);
    try {
      const { data, error: dbError } = await supabase.from('recipes').select('*')
        .eq('user_id', ownerId).order('created_at', { ascending: false });
      if (dbError) throw dbError;
      const withImages = await Promise.all((data || []).map(async recipe => {
        if (!recipe.image_path) return { ...recipe, displayImage: recipe.image_url };
        const { data: signed, error: signedError } = await supabase.storage
          .from('recipe-images').createSignedUrl(recipe.image_path, 3600);
        return { ...recipe, displayImage: signedError ? recipe.image_url : signed?.signedUrl || recipe.image_url };
      }));
      setRecipes(withImages);
    } catch (err) {
      setError(`저장된 레시피를 불러오지 못했어요: ${err.message}`);
    } finally {
      setLoadingRecipes(false);
    }
  }

  async function extractFromUrl(url) {
    setNotice(''); setError('');
    if (!url) { setError('instagram.com/p/... 또는 instagram.com/reel/... 링크를 입력해 주세요.'); return; }
    setExtracting(true);
    setResult(null);
    try {
      const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '게시물을 가져올 수 없어요.');
      setResult(data);
      setDraftTitle(removeInstagramCounts(data.title || '나의 레시피'));
      setDraftCaption(removeInstagramCounts(data.captionCandidate || data.preview || ''));
      setDraftCategory('미분류');
      setImageFile(null);
    } catch (err) {
      setError(err.message || '추출 중 오류가 발생했어요.');
    } finally {
      setExtracting(false);
    }
  }

  function extract(event) {
    event.preventDefault();
    void extractFromUrl(normalizeLink(input));
  }

  async function uploadManualPhoto(recipeId) {
    if (!imageFile) return;
    if (imageFile.size > 6 * 1024 * 1024) throw new Error('사진 용량은 6MB 이하여야 해요.');
    const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const ext = types[imageFile.type];
    if (!ext) throw new Error('JPG, PNG, WEBP 사진만 지원해요.');
    const path = `${user.id}/${recipeId}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('recipe-images')
      .upload(path, imageFile, { contentType: imageFile.type, upsert: false });
    if (uploadError) throw uploadError;
    const { error: updateError } = await supabase.from('recipes').update({ image_path: path }).eq('id', recipeId);
    if (updateError) {
      await supabase.storage.from('recipe-images').remove([path]);
      throw updateError;
    }
  }

  async function save() {
    if (!result?.url || !user) return;
    if (!draftTitle.trim()) { setError('레시피 제목을 입력해 주세요.'); return; }
    setSaving(true); setError(''); setNotice('');
    let inserted = null;
    try {
      const payload = {
        user_id: user.id,
        original_url: normalizeLink(result.url),
        title: removeInstagramCounts(draftTitle.trim()),
        caption: removeInstagramCounts(draftCaption),
        image_url: result.image || null,
        category: draftCategory,
      };
      const { data, error: dbError } = await supabase.from('recipes').insert(payload).select().single();
      if (dbError) {
        if (dbError.code === '23505') throw new Error('이미 저장한 게시물이에요. 내 보관함에서 확인해 주세요.');
        throw dbError;
      }
      inserted = data;
      try {
        if (imageFile) {
          await uploadManualPhoto(data.id);
        } else if (data.image_url) {
          const { data: sessionInfo } = await supabase.auth.getSession();
          const token = sessionInfo.session?.access_token;
          if (token) {
            const response = await fetch('/api/save-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ recipeId: data.id }),
            });
            if (!response.ok) {
              const imageError = await response.json().catch(() => ({}));
              throw new Error(imageError.error || '썸네일 이미지 복사 실패');
            }
          }
        }
        setNotice('레시피와 사진을 저장했어요!');
      } catch (imageError) {
        setNotice('글과 링크는 저장했어요. 사진은 원본 주소로 표시하며 영구 보관되지 않을 수 있어요. ' + imageError.message);
      }
      setResult(null); setInput(''); setImageFile(null);
      await loadRecipes(user.id);
      setActiveTab('library');
    } catch (err) {
      setError(err.message || '저장하지 못했어요.');
      if (inserted) await loadRecipes(user.id);
    } finally {
      setSaving(false);
    }
  }

  const filteredRecipes = useMemo(() => recipes.filter(recipe =>
    (filter === '전체' || recipe.category === filter) &&
    `${recipe.title} ${recipe.caption}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [recipes, search, filter]);
  const selected = recipes.find(recipe => recipe.id === selectedId);

  function openRecipe(recipe) {
    setSelectedId(recipe.id); setEditing(false);
    setEditTitle(removeInstagramCounts(recipe.title)); setEditCaption(removeInstagramCounts(recipe.caption)); setEditCategory(recipe.category);
    setNotice(''); setError('');
  }

  async function updateRecipe() {
    if (!selected) return;
    if (!editTitle.trim()) { setError('제목을 입력해 주세요.'); return; }
    setSaving(true); setError('');
    try {
      const { error: dbError } = await supabase.from('recipes').update({
        title: removeInstagramCounts(editTitle.trim()), caption: removeInstagramCounts(editCaption), category: editCategory,
      }).eq('id', selected.id);
      if (dbError) throw dbError;
      await loadRecipes(user.id);
      setEditing(false); setNotice('레시피를 수정했어요.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function deleteRecipe(recipe) {
    if (!window.confirm(`“${recipe.title}” 레시피를 삭제할까요?`)) return;
    setError('');
    try {
      const { error: dbError } = await supabase.from('recipes').delete().eq('id', recipe.id);
      if (dbError) throw dbError;
      if (recipe.image_path) {
        await supabase.storage.from('recipe-images').remove([recipe.image_path]);
      }
      setSelectedId(null); setEditing(false);
      await loadRecipes(user.id);
      setNotice('레시피를 삭제했어요.');
    } catch (err) { setError(err.message); }
  }

  return <div className="page">
    <header className="topbar">
      <div className="brand"><span className="brand-icon" aria-hidden="true">▤</span><div>레시피 아카이브<span className="brand-sub">ARCHIVE NOTE</span></div></div>
      {user ? <button className="text-button header-action" onClick={() => supabase.auth.signOut()}>로그아웃</button> : <span className="test-pill">PRIVATE</span>}
    </header>

    {!supabase ? <main><section className="form-card config-card"><h2>Supabase 설정이 필요해요</h2><p>Vercel 프로젝트 환경 변수에 다음 두 값을 추가하고 재배포해 주세요.</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code><p>주의: secret / service_role 키는 입력하지 마세요.</p></section></main>
      : !authReady ? <main className="center-message">계정을 확인하고 있어요…</main>
      : !user ? <><AuthScreen onMessage={setNotice} />{notice && <div className="floating-notice" role="status">{notice}</div>}</>
      : <main>
        <nav className="tabs" aria-label="메뉴">
          <button className={activeTab === 'add' ? 'active' : ''} onClick={() => { setActiveTab('add'); setSelectedId(null); setError(''); }}>＋ 추가</button>
          <button className={activeTab === 'library' ? 'active' : ''} onClick={() => { setActiveTab('library'); setError(''); }}>보관함 ({recipes.length})</button>
        </nav>
        {notice && <div className="success-notice" role="status">{notice}</div>}
        {error && <div className="alert" role="alert">{error}</div>}

        {activeTab === 'add' ? <>
          <section className="hero compact-hero"><h1>새 레시피</h1></section>
          <section className="form-card">
            <div className="section-heading"><h2>링크 가져오기</h2></div>
            <form onSubmit={extract}>
              <label htmlFor="link">게시물 또는 릴스 링크</label>
              <div className="input-wrap"><span className="link-mark" aria-hidden="true">↗</span><input id="link" value={input} onChange={event => setInput(event.target.value)} placeholder="https://www.instagram.com/p/..." autoComplete="off" /></div>
              <button type="submit" disabled={extracting}>{extracting ? '게시물 가져오는 중…' : '썸네일과 글 가져오기 →'}</button>
            </form>
          </section>
          {result && <section className="results">
            <div className="result-title"><span>저장할 내용 확인</span><span className="status-pill">수정 가능</span></div>
            <Cover src={result.image} />
            <div className="result-content">
              <label htmlFor="title">제목</label>
              <input className="edit-input" id="title" value={draftTitle} onChange={event => setDraftTitle(event.target.value)} />
              <label className="field-top" htmlFor="caption">게시글 본문</label>
              <textarea id="caption" rows="10" value={draftCaption} onChange={event => setDraftCaption(event.target.value)} placeholder="게시글 본문을 입력해 주세요" />
              {!result.captionCandidate && result.preview && <p className="caution">현재 글은 미리보기 설명에서 가져온 내용이므로 원문 전체가 아닐 수 있어요. 저장 전에 확인해 주세요.</p>}
              <label htmlFor="category" className="field-top">카테고리</label>
              <select id="category" value={draftCategory} onChange={event => setDraftCategory(event.target.value)}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select>
              <label htmlFor="photo" className="field-top">사진 직접 추가 (선택)</label>
              <input id="photo" className="photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setImageFile(event.target.files?.[0] || null)} />
              <p className="fine-print">사진은 자동 보관을 시도해요. 실패하더라도 원문과 링크는 저장돼요. 직접 사진을 선택하면 그 파일을 저장해요.</p>
              <a className="source-link" href={result.url} target="_blank" rel="noopener noreferrer">인스타그램 원본 확인 ↗</a>
              <button className="primary-button" type="button" disabled={saving} onClick={save}>{saving ? '저장 중…' : '내 보관함에 저장하기 →'}</button>
            </div>
          </section>}
          
        </> : <>
          <section className="library-heading"><h1>보관함</h1><p>전체 {recipes.length}개</p></section>
          {selected ? <section className="results detail-card">
            <button className="text-button back-button" onClick={() => { setSelectedId(null); setEditing(false); }}>← 목록으로</button>
            <Cover src={selected.displayImage} />
            <div className="result-content">
              {editing ? <>
                <label htmlFor="edit-title">제목</label><input id="edit-title" className="edit-input" value={editTitle} onChange={event => setEditTitle(event.target.value)} />
                <label htmlFor="edit-caption" className="field-top">게시글 본문</label><textarea id="edit-caption" rows="12" value={editCaption} onChange={event => setEditCaption(event.target.value)} />
                <label htmlFor="edit-category" className="field-top">카테고리</label><select id="edit-category" value={editCategory} onChange={event => setEditCategory(event.target.value)}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select>
                <div className="action-row"><button className="small-primary" onClick={updateRecipe} disabled={saving}>수정 저장</button><button className="small-outline" onClick={() => setEditing(false)}>취소</button></div>
              </> : <>
                <span className="category-tag">{selected.category}</span><h2>{removeInstagramCounts(selected.title)}</h2>
                <div className="caption-block"><div className="field-title">게시글 원문</div><p>{removeInstagramCounts(selected.caption) || '저장된 글이 없습니다.'}</p></div>
                <a className="source-link" href={selected.original_url} target="_blank" rel="noopener noreferrer">인스타그램 원본 보기 ↗</a>
                <div className="action-row"><button className="small-primary" onClick={() => setEditing(true)}>수정</button><button className="small-outline danger-button" onClick={() => deleteRecipe(selected)}>삭제</button></div>
              </>}
            </div>
          </section> : <>
            <input className="search-input" aria-label="레시피 검색" placeholder="레시피 이름이나 글 내용 검색" value={search} onChange={event => setSearch(event.target.value)} />
            <div className="filter-row">{['전체', ...CATEGORIES].map(category => <button key={category} className={filter === category ? 'selected' : ''} onClick={() => setFilter(category)}>{category}</button>)}</div>
            {loadingRecipes ? <p className="empty-state">레시피를 불러오는 중이에요…</p> : filteredRecipes.length === 0 ? <div className="empty-state"><span aria-hidden="true">▤</span><h3>{recipes.length ? '검색 결과 없음' : '저장된 레시피 없음'}</h3></div> : <div className="recipe-grid">{filteredRecipes.map(recipe => <button className="recipe-card" key={recipe.id} onClick={() => openRecipe(recipe)}><Cover src={recipe.displayImage} /><span className="recipe-card-body"><strong>{removeInstagramCounts(recipe.title)}</strong><span>{recipe.category} · {new Date(recipe.created_at).toLocaleDateString('ko-KR')}</span></span></button>)}</div>}
          </>}
        </>}
      </main>}
    <footer>RECIPE ARCHIVE</footer>
  </div>;
}
