# 🔑 API 키 획득 및 설정 가이드

## 📋 필요한 API 키 목록

### 필수 API 키

-   없음 (기본 기능은 API 키 없이 작동)

### 선택적 API 키 (더 나은 성능을 위해 권장)

1. **IEEE_API_KEY** - IEEE Xplore API
2. **CORE_API_KEY** - CORE (Open Access) API
3. **SEMANTIC_SCHOLAR_API_KEY** - Semantic Scholar API
4. **ARXIV_API_KEY** - arXiv API (키 불필요, 무료)

### 참고: Google Scholar API

Google Scholar는 공식 API를 제공하지 않습니다. 대신 `scholarly` Python 라이브러리를 사용하여 크롤링합니다.

---

## 1. IEEE Xplore API 키

### 획득 방법

1. **IEEE Xplore 개발자 포털 방문**

    - https://developer.ieee.org/ 접속

2. **계정 생성**

    - "Create Account" 클릭
    - IEEE 계정이 있다면 로그인
    - 없다면 새로 생성 (무료)

3. **애플리케이션 등록**

    - 로그인 후 "My Apps" 클릭
    - "Create App" 선택
    - 앱 정보 입력:
        - App Name: "Research Assistant"
        - App Description: "Academic research automation"
        - App Type: "Web Application"
        - Callback URL: http://localhost:3000

4. **API 키 발급**
    - 앱 생성 후 "API Keys" 탭에서 키 확인
    - 무료 티어: 월 200회 요청
    - 학술 기관 소속이면 더 많은 할당량 요청 가능

### .env 설정

```bash
IEEE_API_KEY=your_ieee_api_key_here
```

---

## 2. CORE API 키

### 획득 방법

1. **CORE 웹사이트 방문**

    - https://core.ac.uk/services/api 접속

2. **API 키 신청**

    - "Register for API key" 클릭
    - 이메일 주소 입력
    - 사용 목적 선택: "Academic research"

3. **이메일 확인**
    - 등록한 이메일로 API 키 전송됨
    - 무료 티어: 월 10,000회 요청

### .env 설정

```bash
CORE_API_KEY=your_core_api_key_here
```

---

## 3. Semantic Scholar API 키

### 획득 방법

1. **Semantic Scholar API 페이지 방문**

    - https://www.semanticscholar.org/product/api 접속

2. **API 키 요청**

    - "Request API Key" 클릭
    - 양식 작성:
        - Name: 이름
        - Email: 이메일
        - Organization: 소속 (개인이면 "Individual Researcher")
        - Use Case: "Academic research automation"

3. **승인 대기**
    - 보통 1-2일 내 이메일로 API 키 발송
    - 무료 티어: 분당 100회 요청

### .env 설정

```bash
SEMANTIC_SCHOLAR_API_KEY=your_semantic_scholar_api_key_here
```

---

## 4. arXiv API

### 특징

-   **API 키 불필요** ✨
-   완전 무료 및 개방형 API
-   요청 제한: 3초당 1회 (자동 조절됨)

### 사용 방법

```bash
# .env 파일에 추가 설정 불필요
# 코드에서 직접 사용 가능
```

---

## 5. 추가 선택적 API 키

### OpenAI API (향후 기능 확장용)

1. https://platform.openai.com/ 접속
2. 계정 생성 후 "API keys" 메뉴
3. "Create new secret key" 클릭

```bash
OPENAI_API_KEY=sk-...your_key_here
```

### Scopus API (Elsevier)

1. https://dev.elsevier.com/ 접속
2. 계정 생성 및 앱 등록
3. API 키 발급 (기관 라이선스 필요할 수 있음)

```bash
SCOPUS_API_KEY=your_scopus_api_key_here
```

---

## 📝 완성된 .env 파일 예시

```bash
# === API Keys ===
# IEEE Xplore API (선택사항)
IEEE_API_KEY=your_ieee_api_key_here

# CORE API (선택사항)
CORE_API_KEY=your_core_api_key_here

# Semantic Scholar API (선택사항)
SEMANTIC_SCHOLAR_API_KEY=your_semantic_scholar_api_key_here

# OpenAI API (향후 확장용, 선택사항)
OPENAI_API_KEY=sk-...your_key_here

# === Git Configuration ===
GIT_USER_NAME=Research Bot
GIT_USER_EMAIL=bot@research.local

# === Ollama Model Configuration ===
# 8GB GPU용 추천 모델
OLLAMA_MODEL=mixtral:8x7b-instruct-v0.1-q4_K_M

# 더 작은 GPU용 대안
# OLLAMA_MODEL=llama2:7b-chat-q4_K_M
# OLLAMA_MODEL=mistral:7b-instruct-q4_K_M

# === Service Ports ===
MCP_PORT=3000
CRAWLER_PORT=5000
CODE_DEV_PORT=8080
DOC_GEN_PORT=5001

# === Client Configuration ===
CLIENT_URL=http://localhost:3001

# === Redis Configuration ===
REDIS_HOST=redis
REDIS_PORT=6379

# === Paths ===
WORKSPACE_PATH=./workspace
DOCUMENTS_PATH=./documents
LOGS_PATH=./logs
```

---

## 🚀 API 키 없이 시작하기

API 키가 없어도 시스템을 사용할 수 있습니다!

### 무료로 사용 가능한 소스:

-   **arXiv**: 키 불필요, 완전 무료
-   **Google Scholar**: scholarly 라이브러리로 크롤링
-   **PubMed**: 공개 API
-   **DOAJ**: Directory of Open Access Journals

### 기본 .env 설정 (최소 요구사항):

```bash
# Git 설정만 필수
GIT_USER_NAME=Your Name
GIT_USER_EMAIL=your.email@example.com

# 나머지는 기본값 사용
OLLAMA_MODEL=mixtral:8x7b-instruct-v0.1-q4_K_M
```

---

## 🔍 API 키 우선순위

1. **즉시 시작 가능**: API 키 없이 arXiv, Google Scholar 사용
2. **권장**: IEEE API 키 (전기전자공학 논문)
3. **선택적**: CORE, Semantic Scholar (더 많은 논문 접근)

---

## ❓ 자주 묻는 질문

### Q: API 키 없이도 잘 작동하나요?

A: 네! arXiv와 Google Scholar만으로도 대부분의 연구 주제를 다룰 수 있습니다.

### Q: 어떤 API 키를 먼저 얻어야 하나요?

A: 연구 분야에 따라 다릅니다:

-   CS/AI 연구: API 키 없이 시작 (arXiv 충분)
-   전기전자공학: IEEE API 키 추천
-   다학제 연구: Semantic Scholar API 추천

### Q: API 요청 한도를 초과하면?

A: 시스템이 자동으로 다른 소스로 전환하여 계속 작동합니다.

### Q: 유료 API가 있나요?

A: 대부분 무료 티어로 충분합니다. 대규모 연구 프로젝트의 경우 유료 플랜 고려 가능.

---

## 📞 문제 해결

API 키 관련 문제 발생 시:

1. 로그 확인: `./scripts/logs.sh research-crawler`
2. API 키 형식 확인 (공백, 특수문자 주의)
3. API 서비스 상태 확인
4. 할당량 초과 여부 확인

---

**💡 팁**: 처음에는 API 키 없이 시작하고, 필요에 따라 점진적으로 추가하세요!
