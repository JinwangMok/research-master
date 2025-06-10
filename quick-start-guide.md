# 🚀 빠른 시작 가이드

## 프로젝트 구조

```
autonomous-research-system/
├── mcp-server/              # MCP 서버 (Node.js + TypeScript)
│   ├── src/
│   │   ├── index.ts         # 메인 서버 진입점 @
│   │   ├── protocols/       # MCP 프로토콜 구현
│   │   ├── services/        # Ollama 등 서비스
│   │   ├── orchestrators/   # 연구 오케스트레이터
│   │   └── managers/        # 워크플로우 매니저
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── research-crawler/        # 연구 논문 크롤러 (Python)
│   ├── app.py              # Flask 앱
│   ├── requirements.txt
│   └── Dockerfile
│
├── code-developer/         # 코드 개발 서비스 (Node.js + TypeScript)
│   ├── src/
│   │   └── index.ts        # 코드 생성 및 테스트
│   ├── Dockerfile
│   └── package.json
│
├── doc-generator/          # 문서 생성 서비스 (Python)
│   ├── app.py              # 문서 생성기
│   ├── requirements.txt
│   └── Dockerfile
│
├── desktop-app/            # 데스크톱 앱 (Electron + React)
│   ├── src/
│   │   └── App.tsx         # React 메인 컴포넌트
│   ├── electron/
│   │   └── main.js         # Electron 메인 프로세스
│   ├── package.json
│   └── tsconfig.json
│
├── nginx/                  # Nginx 설정 (프로덕션용)
│   └── nginx.conf
│
├── scripts/                # 유틸리티 스크립트
│   ├── setup.sh           # 초기 설정
│   ├── start.sh           # 시스템 시작
│   ├── stop.sh            # 시스템 중지
│   ├── logs.sh            # 로그 확인
│   └── reset.sh           # 시스템 초기화
│
├── docker-compose.yml      # Docker 오케스트레이션
├── .env.example           # 환경 변수 템플릿
└── README.md              # 프로젝트 문서
```

## 🏃‍♂️ 10분 안에 시작하기

### 1. 필수 요구사항 확인

```bash
# Docker 설치 확인
docker --version
docker-compose --version

# Node.js 설치 확인
node --version  # v18+ 필요
npm --version

# GPU 확인 (선택사항)
nvidia-smi
```

### 2. 프로젝트 클론 및 설정

```bash
# 프로젝트 클론
git clone <repository-url>
cd autonomous-research-system

# 실행 권한 부여
chmod +x scripts/*.sh

# 자동 설정 실행
./scripts/setup.sh
```

### 3. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# 편집기로 .env 파일 열기
nano .env  # 또는 선호하는 편집기 사용

# 최소 설정 (API 키는 선택사항)
GIT_USER_NAME="Your Name"
GIT_USER_EMAIL="your.email@example.com"
```

### 4. 시스템 시작

```bash
# 전체 시스템 시작
./scripts/start.sh

# 또는 개별적으로 시작
docker-compose up -d        # Docker 서비스
cd desktop-app && npm run dev  # 데스크톱 앱
```

### 5. 첫 번째 연구 프로젝트

1. **데스크톱 앱 열기**

    - 자동으로 열리거나 http://localhost:3001 접속

2. **연구 주제 입력**

    - 예: "IoT 기기를 위한 경량 블록체인 합의 알고리즘"

3. **질문에 답변**

    - 시스템이 2-3개의 구체화 질문을 함
    - 상세히 답변할수록 좋은 결과

4. **진행 상황 모니터링**

    - 실시간으로 각 단계 진행률 확인
    - 로그 패널에서 상세 활동 확인

5. **결과물 다운로드**
    - PDF 보고서
    - LaTeX 논문
    - PowerPoint 프레젠테이션

## 🔧 문제 해결

### Docker 서비스가 시작되지 않음

```bash
# Docker 상태 확인
docker ps

# 서비스 로그 확인
./scripts/logs.sh mcp-server

# 서비스 재시작
docker-compose restart mcp-server
```

### GPU 메모리 부족

`.env` 파일에서 더 작은 모델로 변경:

```bash
# 7B 모델로 변경 (더 적은 메모리 사용)
OLLAMA_MODEL=llama2:7b-chat-q4_K_M
```

### 포트 충돌

`.env` 파일에서 포트 변경:

```bash
MCP_PORT=3001
CRAWLER_PORT=5001
```

## 📊 서비스 모니터링

### 상태 확인

```bash
# 전체 서비스 상태
docker-compose ps

# 개별 서비스 건강 상태
curl http://localhost:3000/health  # MCP Server
curl http://localhost:5000/health  # Research Crawler
```

### 로그 확인

```bash
# 실시간 로그 (모든 서비스)
./scripts/logs.sh

# 특정 서비스 로그
./scripts/logs.sh ollama
```

### 리소스 사용량

```bash
# Docker 리소스 사용량
docker stats

# GPU 사용량
nvidia-smi -l 1
```

## 🎯 사용 팁

1. **구체적인 주제 입력**

    - ❌ "AI 연구"
    - ✅ "자율주행차를 위한 실시간 객체 인식 알고리즘 최적화"

2. **상세한 답변 제공**

    - 기술 스택, 제약사항, 목표 성능 등 포함

3. **단계별 검토**

    - 각 단계 완료 후 결과 검토
    - 필요시 피드백 제공

4. **리소스 관리**
    - 대규모 프로젝트는 충분한 디스크 공간 확보
    - GPU 메모리 모니터링

## 🚨 중요 참고사항

-   첫 실행 시 모델 다운로드로 시간이 걸릴 수 있음 (약 10-20분)
-   8GB GPU에서는 양자화된 모델 사용 권장
-   생성된 코드는 항상 검토 후 사용
-   API 키 없이도 기본 기능 사용 가능

## 🆘 도움말

-   문제 발생 시 GitHub Issues 생성
-   로그 파일 첨부: `./logs/` 디렉토리
-   시스템 정보 포함: OS, Docker 버전, GPU 정보

---

# ✅ 첫 실행 체크리스트

## 1. 환경 설정

```bash
# 1. .env 파일 생성 (최소 설정)
cp .env.example .env

# 2. Git 사용자 정보만 수정
nano .env
# GIT_USER_NAME과 GIT_USER_EMAIL을 본인 정보로 변경

# 3. 나머지는 기본값 사용!
```

## 2. 시스템 시작 전 확인

```bash
# Docker 실행 확인
docker --version
docker ps

# GPU 확인 (선택사항)
nvidia-smi

# 포트 사용 확인
lsof -i :3000  # 사용 중이면 .env에서 포트 변경
```

## 3. 첫 실행

```bash
# 설정 스크립트 실행
./scripts/setup.sh

# 시스템 시작
./scripts/start.sh

# 로그 모니터링 (다른 터미널에서)
./scripts/logs.sh
```

## 🎯 API 키 없이 사용 가능한 기능

### ✅ 완전히 작동하는 기능:

1. **arXiv 논문 검색** - CS, 물리학, 수학 등
2. **Google Scholar 크롤링** - 모든 학문 분야
3. **코드 생성 및 테스트** - 모든 프로그래밍 언어
4. **문서 생성** - PDF, LaTeX, PPT
5. **Git 버전 관리** - 자동 커밋

### ⚠️ 제한적으로 작동하는 기능:

1. **IEEE 논문** - API 키 필요 (전기전자공학)
2. **CORE 논문** - API 키 필요 (오픈 액세스)
3. **Semantic Scholar** - API 키 필요 (인용 분석)

## 🏃‍♂️ 첫 번째 연구 프로젝트 예시

### API 키 없이 시도해볼 수 있는 주제:

1. **컴퓨터 과학 (arXiv 활용)**

    - "연합학습을 위한 차등 프라이버시 알고리즘"
    - "그래프 신경망 기반 추천 시스템"
    - "양자 컴퓨팅 시뮬레이터 최적화"

2. **인공지능/머신러닝 (arXiv + Scholar)**

    - "Transformer 모델의 메모리 효율적 학습 방법"
    - "자율주행을 위한 실시간 객체 탐지"
    - "의료 영상에서의 few-shot 학습"

3. **일반 공학 (Google Scholar)**
    - "스마트 시티를 위한 IoT 아키텍처"
    - "재생 에너지 최적화 알고리즘"
    - "드론 군집 제어 시스템"

## 🔧 일반적인 문제 해결

### 1. Ollama 모델 다운로드 실패

```bash
# 수동으로 모델 다운로드
docker exec -it research-ollama ollama pull mixtral:8x7b-instruct-v0.1-q4_K_M

# 더 작은 모델로 변경
docker exec -it research-ollama ollama pull llama2:7b-chat-q4_K_M
# 그리고 .env 파일에서 OLLAMA_MODEL 변경
```

### 2. 메모리 부족

```bash
# .env 파일 수정
OLLAMA_MODEL=llama2:7b-chat-q4_K_M  # 더 작은 모델
MAX_PAPERS_PER_SEARCH=10             # 검색 논문 수 줄이기
```

### 3. 포트 충돌

```bash
# .env 파일에서 포트 변경
MCP_PORT=3001
CRAWLER_PORT=5001
# ...
```

### 4. Docker 권한 문제

```bash
# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER
# 로그아웃 후 다시 로그인
```

## 📊 성능 모니터링

```bash
# GPU 사용량 실시간 모니터링
watch -n 1 nvidia-smi

# Docker 리소스 사용량
docker stats

# 서비스 상태 확인
curl http://localhost:3000/health
curl http://localhost:5000/health
```

## 💡 프로 팁

1. **첫 실행은 느릴 수 있습니다**

    - Ollama 모델 다운로드: 10-20분
    - Docker 이미지 빌드: 5-10분

2. **무료 리소스 최대 활용**

    - arXiv는 프리프린트가 많아 최신 연구 접근 가능
    - Google Scholar는 대부분의 논문 메타데이터 제공

3. **점진적 확장**

    - 처음엔 API 키 없이 시작
    - 필요에 따라 하나씩 추가

4. **캐싱 활용**
    - 같은 검색은 캐시에서 제공
    - Redis가 자동으로 관리

## 🆘 도움이 필요하신가요?

1. **로그 확인**

    ```bash
    ./scripts/logs.sh | grep ERROR
    ```

2. **서비스 재시작**

    ```bash
    docker-compose restart mcp-server
    ```

3. **전체 리셋**
    ```bash
    ./scripts/reset.sh  # 주의: 모든 데이터 삭제
    ```

---

**준비되셨나요?** 🚀

API 키 없이도 바로 시작할 수 있습니다.
첫 연구 주제를 입력하고 자율 연구 시스템의 강력함을 경험해보세요!
