# 🚀 Windows 완전 시작 가이드

## 📋 사전 준비 (한 번만 실행)

### 1. 필수 소프트웨어 설치 확인

```powershell
# PowerShell (관리자 권한)
# Docker Desktop 확인
docker --version

# Node.js 확인 (v18 이상)
node --version
npm --version

# Git 확인
git --version
```

### 2. WSL2 설정 (Docker Desktop 필수)

```powershell
# WSL2 설치 및 업데이트
wsl --install
wsl --update
wsl --set-default-version 2
```

## 🏗️ 프로젝트 설정 (단계별)

### Step 1: 프로젝트 클론 및 구조 생성

```batch
# 명령 프롬프트
cd C:\Projects
git clone <your-repository> autonomous-research-system
cd autonomous-research-system

# 디렉토리 구조 생성
create-structure.bat
```

### Step 2: 환경 파일 설정

```batch
# .env 파일 생성
copy .env.example .env
notepad .env
```

**최소 설정 (.env):**

```env
# 필수 설정
GIT_USER_NAME=Your Name
GIT_USER_EMAIL=your.email@example.com

# GPU 메모리에 따른 모델 선택
# 8GB GPU:
OLLAMA_MODEL=mixtral:8x7b-instruct-v0.1-q4_K_M
# 6GB GPU:
# OLLAMA_MODEL=mistral:7b-instruct-q4_K_M
# 4GB GPU:
# OLLAMA_MODEL=llama2:7b-chat-q4_K_M
```

### Step 3: Docker 이미지 빌드 (첫 실행시만)

```batch
# 빠른 빌드를 위한 사전 이미지 다운로드
docker pull node:18-alpine
docker pull python:3.11-slim
docker pull redis:7-alpine
docker pull ollama/ollama:latest

# Docker Compose 빌드
docker-compose build --parallel
```

### Step 4: 의존성 설치

```batch
# 각 서비스별 의존성 설치
cd mcp-server
npm install
cd ..

cd code-developer
npm install
cd ..

cd desktop-app
npm install
cd ..
```

### Step 5: 시스템 시작

```batch
# 서비스 시작
scripts\start.bat
```

## 🔍 시작 확인 체크리스트

### 1. Docker 서비스 확인

```powershell
# PowerShell
docker ps
```

다음 컨테이너들이 실행 중이어야 함:

-   research-ollama
-   research-redis
-   research-mcp-server
-   research-crawler
-   code-developer
-   doc-generator

### 2. 서비스 상태 확인

```powershell
# 각 서비스 health check
$services = @(
    @{Name="MCP Server"; Port=3000},
    @{Name="Research Crawler"; Port=5000},
    @{Name="Code Developer"; Port=8080},
    @{Name="Document Generator"; Port=5001}
)

foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($service.Port)/health" -UseBasicParsing
        Write-Host "✅ $($service.Name) is running" -ForegroundColor Green
    } catch {
        Write-Host "❌ $($service.Name) is not responding" -ForegroundColor Red
    }
}
```

### 3. Ollama 모델 확인

```batch
docker exec research-ollama ollama list
```

## 📱 데스크톱 앱 실행

### 개발 모드

```batch
cd desktop-app
npm run dev
```

### 프로덕션 빌드

```batch
cd desktop-app
npm run build
npm run dist:win
```

## 🎯 첫 번째 연구 시작

1. **브라우저 열기**: http://localhost:3000
2. **연구 주제 입력 예시**:

    - "블록체인 기반 IoT 보안 프로토콜"
    - "딥러닝을 활용한 실시간 이상 탐지"
    - "양자 컴퓨팅 알고리즘 최적화"

3. **질문 답변**: 시스템이 2-3개 질문을 하면 상세히 답변

4. **진행 모니터링**: 우측 Activity Log에서 실시간 진행 상황 확인

## 🐛 일반적인 문제 해결

### 1. "Cannot connect to Docker daemon" 오류

```powershell
# Docker Desktop 재시작
Stop-Process -Name "Docker Desktop" -Force
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
Start-Sleep -Seconds 30
```

### 2. 포트 충돌 (Port already in use)

```powershell
# 포트 사용 프로세스 확인
netstat -ano | findstr :3000

# 프로세스 종료 (PID 확인 후)
taskkill /PID [PID번호] /F
```

### 3. npm install 오류

```batch
# 캐시 정리 및 재설치
cd desktop-app
rd /s /q node_modules
del package-lock.json
npm cache clean --force
npm install
```

### 4. Ollama 모델 다운로드 실패

```batch
# 수동 다운로드
docker exec -it research-ollama sh
ollama pull mixtral:8x7b-instruct-v0.1-q4_K_M
exit
```

### 5. GPU 메모리 부족

```batch
# 더 작은 모델로 변경
docker exec research-ollama ollama pull llama2:7b-chat-q4_K_M

# .env 파일 수정
notepad .env
# OLLAMA_MODEL=llama2:7b-chat-q4_K_M

# 서비스 재시작
docker-compose restart ollama mcp-server
```

## 📊 성능 모니터링

### GPU 사용량 (NVIDIA)

```powershell
# 실시간 모니터링
nvidia-smi -l 1
```

### Docker 리소스

```powershell
# 컨테이너별 사용량
docker stats
```

### 로그 확인

```batch
# 전체 로그
scripts\logs.bat

# 특정 서비스 로그
scripts\logs.bat mcp-server
```

## 🚀 프로덕션 팁

### 1. 자동 시작 설정

작업 스케줄러에서 시스템 시작시 `scripts\start.bat` 실행

### 2. 백업 설정

```powershell
# 작업 백업 스크립트
$backupPath = "C:\Backups\research-system"
$date = Get-Date -Format "yyyy-MM-dd"

# 중요 데이터 백업
Copy-Item -Path ".\workspace" -Destination "$backupPath\$date\workspace" -Recurse
Copy-Item -Path ".\documents" -Destination "$backupPath\$date\documents" -Recurse
Copy-Item -Path ".\git_repos" -Destination "$backupPath\$date\git_repos" -Recurse
```

### 3. 리소스 최적화

-   Docker Desktop: Settings → Resources
    -   CPUs: 4-8개
    -   Memory: 8-16GB
    -   Disk image size: 100GB+

## 📝 체크리스트 요약

-   [ ] Docker Desktop 실행 중
-   [ ] WSL2 활성화
-   [ ] .env 파일 설정 완료
-   [ ] Docker 이미지 빌드 완료
-   [ ] 모든 서비스 health check 통과
-   [ ] Ollama 모델 다운로드 완료
-   [ ] 데스크톱 앱 실행 확인

## 🆘 추가 도움말

### 로그 디버깅

```powershell
# 상세 로그 보기
docker-compose logs -f --tail=100 mcp-server

# 에러만 필터링
docker-compose logs | Select-String "ERROR"
```

### 완전 초기화

```batch
scripts\reset.bat
scripts\setup.bat
scripts\start.bat
```

---

**축하합니다!** 🎉 이제 Windows에서 완전한 자율 연구 시스템을 사용할 수 있습니다.

질문이나 문제가 있으면 다음을 확인하세요:

1. `logs/` 폴더의 로그 파일
2. Docker Desktop 로그
3. 브라우저 개발자 도구 콘솔 (F12)
