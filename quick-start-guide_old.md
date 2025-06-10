# 🎯 최종 빠른 참조 가이드

## 🚀 원클릭 시작 (PowerShell)

```powershell
# 관리자 권한 PowerShell에서 실행
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
.\quick-start.ps1
```

## 📌 5분 안에 시작하기

### 1. 최소 설정 (.env)
```env
GIT_USER_NAME=My Bot
GIT_USER_EMAIL=bot@local
OLLAMA_MODEL=llama2:7b-chat-q4_K_M
```

### 2. 빠른 시작 명령어
```batch
# 명령 프롬프트
docker-compose up -d
cd desktop-app && npm run dev
```

### 3. 브라우저 열기
- http://localhost:3000

## 🔥 자주 사용하는 명령어

### 시스템 관리
```batch
# 시작
scripts\start.bat

# 중지
scripts\stop.bat

# 로그 보기
scripts\logs.bat

# 상태 확인
docker ps
```

### 개발 명령어
```batch
# 데스크톱 앱 개발
cd desktop-app
npm run dev

# 특정 서비스 재시작
docker-compose restart mcp-server

# 전체 재빌드
docker-compose build --no-cache
```

## ❓ FAQ

### Q: 첫 실행이 느려요
**A:** 정상입니다. 첫 실행시:
- Docker 이미지 다운로드: 5-10분
- Ollama 모델 다운로드: 10-20분
- 두 번째 실행부터는 1-2분

### Q: GPU를 사용하지 않아요
**A:** Docker Desktop 설정 확인:
1. Settings → Resources → Advanced
2. "GPU support" 활성화
3. Docker 재시작

### Q: 메모리 부족 오류
**A:** 
1. 더 작은 모델 사용: `OLLAMA_MODEL=phi-2:2.7b-chat-q4_K_M`
2. Docker 메모리 증가: Settings → Resources → Memory: 8GB+

### Q: 포트 충돌
**A:** .env에서 포트 변경:
```env
MCP_PORT=3001
CRAWLER_PORT=5001
```

### Q: 연구가 진행되지 않아요
**A:** 
1. 서비스 상태 확인: `curl http://localhost:3000/health`
2. 로그 확인: `docker-compose logs mcp-server`
3. Redis 재시작: `docker-compose restart redis`

## 💡 성능 팁

### 1. GPU 메모리 최적화
```env
# 메모리별 추천 모델
# 8GB: mixtral:8x7b-instruct-v0.1-q4_K_M
# 6GB: mistral:7b-instruct-q4_K_M  
# 4GB: llama2:7b-chat-q4_K_M
# 2GB: phi-2:2.7b-chat-q4_K_M
```

### 2. 빌드 시간 단축
```powershell
# 병렬 빌드
docker-compose build --parallel

# 캐시 활용
docker-compose build --build-arg BUILDKIT_INLINE_CACHE=1
```

### 3. 개발 효율
```batch
# 핫 리로드 활성화
cd desktop-app
npm run dev

# 특정 서비스만 로그
docker-compose logs -f mcp-server
```

## 🎯 빠른 테스트 주제

### 초보자용
- "Python으로 웹 스크래퍼 만들기"
- "React로 Todo 앱 개발"
- "기본 REST API 서버 구축"

### 중급자용  
- "머신러닝을 활용한 주식 가격 예측"
- "블록체인 기반 투표 시스템"
- "실시간 채팅 애플리케이션"

### 고급자용
- "분산 시스템에서의 합의 알고리즘 구현"
- "양자 컴퓨팅 시뮬레이터 개발"
- "연합학습 프레임워크 설계"

## 📞 문제 해결 연락처

### 로그 위치
- Docker 로그: `docker-compose logs`
- 앱 로그: `logs/` 폴더
- 시스템 로그: Windows 이벤트 뷰어

### 디버깅 모드
```env
# .env에 추가
NODE_ENV=development
DEBUG=*
```

### 완전 초기화
```batch
scripts\reset.bat
rmdir /s /q node_modules
docker system prune -a
scripts\setup.bat
```

---

**🎉 축하합니다!** 이제 Windows에서 완벽하게 작동하는 자율 연구 시스템을 사용할 수 있습니다.

**다음 단계:**
1. 첫 연구 프로젝트 시작
2. 생성된 코드와 문서 확인
3. 피드백을 통한 개선

**팁:** 시스템이 학습하고 개선되는 과정을 관찰하면서 더 나은 결과를 얻을 수 있습니다!