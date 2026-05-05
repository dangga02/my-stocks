# 프론트엔드 (PWA) 배포 가이드

휴대폰 홈화면에 설치되는 웹앱입니다. GitHub Pages에 무료로 호스팅합니다.

## 사전 준비

- Cloudflare Worker 백엔드가 먼저 배포되어 있어야 합니다 (`backend/README.md` 참고)
- Worker URL을 메모해두세요 (예: `https://kis-proxy.본인계정.workers.dev`)
- GitHub 계정 (https://github.com — 무료)

## 배포 단계

### 1) GitHub 저장소 만들기

1. https://github.com/new 접속
2. Repository name: `my-stocks` (아무거나 가능, 이 이름이 URL에 들어감)
3. Public 선택 (GitHub Pages는 무료 계정에서 Public만 무료)
4. Create repository 클릭

### 2) 이 폴더의 파일 업로드

가장 쉬운 방법은 **웹에서 드래그앤드롭**:

1. 만든 저장소 페이지에서 "uploading an existing file" 링크 클릭
2. 이 `frontend` 폴더 안의 **모든 파일**을 끌어다 놓기:
   - `index.html`
   - `app.js`
   - `style.css`
   - `manifest.json`
   - `sw.js`
   - `icon-192.png`
   - `icon-512.png`
3. 아래 "Commit changes" 클릭

### 3) GitHub Pages 활성화

1. 저장소의 **Settings** 탭 클릭
2. 왼쪽 메뉴에서 **Pages** 클릭
3. Source: **Deploy from a branch** 선택
4. Branch: **main** / **/(root)** 선택 후 Save
5. 1~2분 기다리면 위에 `https://본인유저명.github.io/my-stocks/` 같은 주소가 나옵니다

### 4) 휴대폰에서 접속

위 주소를 휴대폰 브라우저로 열어주세요.

### 5) API 주소 입력

처음 열면 "API 주소를 입력해주세요" 라고 나옵니다.

상단 입력창에 Cloudflare Worker URL을 붙여넣고 **저장**:

```
https://kis-proxy.본인계정.workers.dev
```

저장하면 자동으로 시세를 가져옵니다.

### 6) 홈화면에 추가

**아이폰 (Safari):**
1. 하단 공유 버튼 (네모+화살표) 누르기
2. "홈 화면에 추가" 선택
3. 추가

**안드로이드 (Chrome):**
1. 우상단 점 3개 메뉴
2. "홈 화면에 추가" 또는 "앱 설치"
3. 설치

이제 일반 앱처럼 아이콘으로 실행할 수 있어요.

## 보안 강화 (선택)

배포가 끝나면 Worker의 CORS 설정을 본인 도메인으로 좁히세요:

```bash
cd backend
wrangler secret put ALLOWED_ORIGIN
# → https://본인유저명.github.io 입력 (마지막 슬래시 없이)
wrangler deploy
```

이러면 다른 사람이 본인의 Worker URL을 알아도 못 씁니다.

## 종목 추가하기

앱에서 종목코드 6자리와 이름을 입력하면 됩니다:

| 종목 | 코드 |
|---|---|
| 삼성전자 | 005930 |
| SK하이닉스 | 000660 |
| LG에너지솔루션 | 373220 |
| 삼성바이오로직스 | 207940 |
| NAVER | 035420 |
| 카카오 | 035720 |
| 현대차 | 005380 |
| 기아 | 000270 |
| POSCO홀딩스 | 005490 |
| 한화에어로스페이스 | 012450 |
| 에코프로비엠 | 247540 |
| 알테오젠 | 196170 |

종목코드는 네이버 금융에서 찾으면 빨라요.

## 코드 수정 후 재배포

파일을 수정했으면:
1. GitHub 저장소에서 해당 파일 클릭 → 연필 아이콘으로 편집
2. 또는 새 파일을 다시 업로드
3. 1~2분 기다리면 자동 반영

휴대폰에서 변경사항이 안 보이면 Service Worker 캐시 때문일 수 있어요. 앱 삭제 후 다시 설치하거나, Chrome DevTools로 캐시를 비워주세요.
