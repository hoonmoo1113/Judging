# 경연 심사 채점 앱 (Express + Turso + Render)

심사위원이 폰으로 접속해 팀별 점수를 매기면, 진행자 화면에 40/35/25% 가중치로 **실시간 합산·순위**가 표시되는 웹앱입니다.

- 채점 기준: 무대장악력(40) · 실력(30) · 창의성(30) = 100점
- 반영 비율: 음악전문가 40% · 청소년전문가 35% · 청소년음악가 25%
- 역할: 심사위원 3명(채점) / 진행자(PIN으로 결과·설정)

---

## 1) Turso 데이터베이스 만들기 (무료)

방법 A — 웹 대시보드
1. https://turso.tech 가입 → 로그인
2. **Create Database** → 이름 입력(예: `judging`) → 지역 선택 → 생성
3. 생성된 DB에서 **Connect / URL** 값을 복사 → `TURSO_DATABASE_URL`
4. **Create Token**(또는 Tokens) → 토큰 생성·복사 → `TURSO_AUTH_TOKEN`

방법 B — CLI
```
curl -sSfL https://get.tur.so/install.sh | bash   # 설치
turso auth signup                                  # 가입/로그인
turso db create judging                            # DB 생성
turso db show judging --url                         # URL 복사 (TURSO_DATABASE_URL)
turso db tokens create judging                      # 토큰 복사 (TURSO_AUTH_TOKEN)
```

---

## 2) GitHub에 올리기

1. GitHub에서 새 저장소(repo) 생성 (예: `judging-app`, Public/Private 무관)
2. 이 폴더 전체를 그 저장소에 올립니다.
   - 웹으로 할 경우: repo 페이지 → **Add file → Upload files** → 이 폴더의 파일을 모두 끌어다 놓고 Commit
   - 명령줄로 할 경우:
     ```
     git init
     git add .
     git commit -m "judging app"
     git branch -M main
     git remote add origin https://github.com/<사용자명>/<repo>.git
     git push -u origin main
     ```
   - ⚠️ `.env` 파일은 올리지 마세요(비밀 토큰). `.gitignore`에 이미 제외돼 있습니다.

---

## 3) Render에 배포하기 (무료)

1. https://render.com 가입 → **New +** → **Web Service**
2. 방금 만든 GitHub 저장소를 연결(Connect)
3. 설정값
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. **Environment**(환경 변수)에 아래 3개 추가
   - `TURSO_DATABASE_URL` = (1단계에서 복사한 URL)
   - `TURSO_AUTH_TOKEN` = (1단계에서 복사한 토큰)
   - `ADMIN_PIN` = 원하는 진행자 PIN (예: 1234)
5. **Create Web Service** → 빌드가 끝나면 `https://<이름>.onrender.com` 주소가 생깁니다.

> 팁: 무료 플랜은 한동안 접속이 없으면 잠들었다가 첫 요청 때 20~50초 깨어납니다. 행사 시작 전 한 번 열어 깨워두세요.

---

## 4) 사용하기

1. 배포된 주소를 진행자가 열고 → **진행자** → PIN 입력 → **설정·QR** 탭에서 **QR 확인**
2. 심사위원은 그 **QR을 폰으로 찍어 접속** → 본인 역할(음악전문가/청소년전문가/청소년음악가) 선택 → 팀별 점수 입력(자동 저장)
3. 진행자 화면 **실시간 순위** 탭에서 가중 합산·순위가 1.5초마다 갱신됩니다.
4. 연습 후 실전 전에는 **설정 → 모든 점수 초기화**로 리셋(같은 주소·QR 그대로 사용).

## 팀 이름·심사위원·비율 변경
- 팀 이름: 앱의 **진행자 → 설정**에서 바로 수정
- 심사위원/비율/배점: `server.js` 상단 `JUDGES`, `CRITERIA` 수정 후 다시 push(자동 재배포)

## 로컬 테스트(선택)
```
npm install
# .env.example 를 .env 로 복사해 값 채우기 (Turso 없이 테스트하려면 그냥 실행 → local.db 파일 사용)
npm start        # http://localhost:3000
```
