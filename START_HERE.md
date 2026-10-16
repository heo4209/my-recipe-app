# 나의 레시피 보관함 — 1단계: 인스타그램 공개 웹페이지 추출 테스트

이것은 완성된 레시피 저장 앱이 아닙니다. 외부 유료 API나 AI를 쓰지 않고 공개 인스타그램 웹페이지에서 이미지 및 본문 후보를 어느 정도 읽을 수 있는지 검사하는 첫 번째 버전입니다.

## GitHub 업로드

1. 압축파일을 풀고 **폴더 안에 있는 파일과 폴더들만** 선택합니다.
2. GitHub에서 이미 만든 `my-recipe-app` 저장소를 엽니다.
3. `Add file` → `Upload files`에 선택한 항목을 드래그합니다.
4. `package.json`, `index.html`, `vite.config.js`, `api/scrape.js`, `src/App.jsx`가 최상위 경로에 정확히 들어갈 수 있도록 업로드 내용을 확인합니다.
5. `Commit changes`를 누릅니다.

## Vercel 배포

1. Vercel → `Add New` → `Project` → GitHub의 `my-recipe-app`을 선택합니다.
2. Framework Preset은 `Vite`, Root Directory는 `./`, Build Command는 `npm run build`, Output Directory는 `dist`인지 확인합니다.
3. `Deploy`를 누르고 제공된 `*.vercel.app` 주소를 엽니다.
4. 테스트 화면에서 **공개** 인스타그램 게시물 URL을 입력합니다.

## 결과 해석

- `captionCandidate`가 비어 있으면 해당 웹페이지에서 캡션 전체를 읽을 수 없었을 가능성이 있습니다.
- `preview`는 사이트의 미리보기 설명입니다. 인스타그램 캡션 원문 전체라고 가정하면 안 됩니다.
- 이미지 URL이 존재하더라도 인스타그램의 이미지 표시 제한 때문에 브라우저에서 표시되지 않을 수 있습니다.
- 인스타그램이 HTML 요청을 차단하거나 로그인을 요구하면 추출되지 않습니다. 이를 우회하지 않습니다.

## 로컬 개발 (선택)

```bash
npm install
npm run dev
```

Vite 개발 서버만 켜면 `/api/scrape` 서버 함수는 로컬에서 작동하지 않습니다. 이번 단계는 Vercel에 배포하여 테스트해 주세요. 추후 Vercel CLI로 함수까지 로컬 테스트할 수 있습니다.

## 개인정보와 보안

이 프로젝트는 1단계 공개 페이지 테스트로 로그인 기능이나 데이터 저장 기능을 포함하지 않습니다. 오래 운영할 때에는 로그인 인증, 서버 측 접근 제한, 요청 제한을 추가해야 합니다. 본인의 API 키나 비밀번호를 GitHub에 업로드하지 마세요.
