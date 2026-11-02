# 올오피스 (AllOffice)

워드, 엑셀, 파워포인트, PDF, 한글(HWP), 마크다운, HTML 문서와 마인드맵을 한 창에서
열고 고치는 무료 데스크톱 오피스 프로그램입니다. AI에게 말로 부탁하면 AI가 문서를
직접 고칩니다.

학교 업무에 맞춰 고쳐 쓰려고 만든 개인 프로젝트이며, 오픈소스
[이음오피스](https://github.com/pblsketch/openoffice)를 바탕으로 했습니다.

## 내려받기와 설치

1. [릴리스 페이지](https://github.com/EricKOR1/alloffice/releases/latest)에서
   `AllOffice-Setup-<버전>.exe`를 받습니다. (64비트 Windows 10/11)
2. 설치 파일에 코드 서명이 없어 "Windows의 PC 보호" 창이 뜹니다.
   **추가 정보 → 실행**을 누르세요.
3. 설치하면 앱이 새 버전을 스스로 확인합니다.

## AI 연결

- **Claude 또는 ChatGPT 구독**이 있으면 PC에 Claude Code 또는 Codex를 설치하고
  로그인해 두면 됩니다. 앱의 **설정 → AI → 구독 연결**이 단계별로 안내합니다.
- 구독이 없으면 **설정 → AI → 무료로 쓰기**에서 OpenRouter나 Google Gemini를
  연결합니다. 무료 AI에 보낸 내용은 그 회사의 AI 개선에 쓰일 수 있으니 개인정보가
  담긴 문서는 주의하세요.

## 새 버전 내기 (관리자용)

1. `apps/shell/package.json`의 `version`을 올립니다. (예: `1.0.1`)
2. 릴리스 페이지에서 **Draft a new release** → 태그 `v1.0.1` 만들기 → **Publish**
3. GitHub Actions가 Windows 설치 파일을 만들어 그 릴리스에 붙입니다(20~40분).

## 직접 빌드하기

Node 22.12 이상, Rust(`cargo`)가 필요합니다.

```
git clone https://github.com/EricKOR1/alloffice.git
cd alloffice
npm install
npm run dev
```

## 보안 메모

- 이 저장소에 릴리스를 올릴 수 있는 계정이 모든 사용자에게 업데이트를 보낼 수
  있습니다. GitHub 계정의 2단계 인증을 켜 두세요.
- AI의 "프로젝트 모드"에서 **프로젝트 신뢰**를 켜면 AI가 PC 명령을 실행할 수
  있습니다. 출처를 모르는 문서를 다룰 때는 끄세요.
- 개인정보 처리 방식은 [PRIVACY.md](PRIVACY.md)에 있습니다.

## 라이선스와 출처

올오피스는 [Apache License 2.0](LICENSE)으로 배포합니다.

- 올오피스는 [이음오피스](https://github.com/pblsketch/openoffice)(Apache-2.0)를
  고쳐 만들었고, 이음오피스는 Genspark(Mainfunc, Inc.)의
  [GenOffice](https://github.com/genspark-ai/genoffice)(Apache-2.0)를 고쳐
  만들었습니다. 문서 엔진과 편집기는 이 두 프로젝트에서 왔습니다.
- 올오피스에서 바꾼 것: 제품 이름, 앱 아이콘·로고, 배포 저장소, 그 밖의 변경은
  git 기록에 있습니다. 원래의 저작권 고지는 그대로 두었습니다([NOTICE](NOTICE)).
- 원본 이음오피스의 설명서는 [docs/upstream-README.ko.md](docs/upstream-README.ko.md)에
  참고용으로 남겨 두었습니다.
- 올오피스는 독립된 개인 프로젝트로, Genspark / Mainfunc, Inc., 이음오피스 프로젝트,
  Anthropic, OpenAI, 한글과컴퓨터와 제휴하거나 보증을 받은 관계가 아닙니다.
  "GenOffice", "이음오피스", "Claude", "Codex", "ChatGPT", "한글", "HWP"는 각
  소유자의 상표입니다.

문의와 문제 신고: [GitHub Issues](https://github.com/EricKOR1/alloffice/issues)
