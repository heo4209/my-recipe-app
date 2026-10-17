# 레시피 앱 — 안드로이드 공유하기 연동

이 압축파일은 GitHub 저장소 루트에 내용 그대로 업로드합니다.
기존 `api/scrape.js`, Supabase SQL, 환경 변수 및 회원가입 버튼은 변경하지 않습니다.

포함 항목:
- src/App.jsx: 공유 URL 수신 후 스크래핑 자동 실행, 저장 전 확인 (기존 로그인·저장 기능 유지)
- src/main.jsx: 서비스 워커 등록
- index.html: 설치용 manifest 연결
- public/manifest.webmanifest: 안드로이드 Web Share Target 등록
- public/sw.js: 서비스 워커 (온라인 전용)
- public/icons: 앱 설치 아이콘
- vercel.json: /share를 React 앱으로 보내는 경로 설정

## 업로드
1. ZIP을 압축 해제하세요.
2. GitHub의 `my-recipe-app` > `Add file` > `Upload files`에 파일과 폴더를 모두 업로드하세요.
3. 커밋 후 Vercel의 Production 배포가 Ready인지 확인하세요.
4. 휴대폰 Chrome에서 기존 Vercel Production 사이트를 열고 `⋮` > `앱 설치`를 누르세요.
5. Instagram 게시물의 공유 > 더보기/다른 앱 > `레시피 보관함`을 선택하세요.
6. 미리보기가 열리면 원문을 확인하고 `내 보관함에 저장하기`를 누르세요.

## 참고
- 인스타그램에서 제공하는 URL만 수신합니다. 캡션이나 이미지를 시스템 공유 메뉴가 직접 주지는 않습니다.
- 인스타그램 웹 스크래핑 실패 시 링크를 수동으로 붙여넣어 테스트하세요.
- 설치형 앱이 공유 대상 목록에 없으면 Chrome으로 설치했는지, 올바른 사이트 주소인지 확인하세요.
- 환경 변수 또는 Supabase 설정 추가는 필요하지 않습니다.
- 인터넷이 연결되어 있어야 합니다. 오프라인 저장 기능은 포함하지 않습니다.
