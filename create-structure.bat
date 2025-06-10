@echo off
echo Creating project structure...

REM 메인 디렉토리들
mkdir mcp-server\src\protocols
mkdir mcp-server\src\services  
mkdir mcp-server\src\orchestrators
mkdir mcp-server\src\managers

mkdir research-crawler\tests

mkdir code-developer\src

mkdir doc-generator\tests

mkdir desktop-app\src
mkdir desktop-app\public
mkdir desktop-app\electron
mkdir desktop-app\assets

mkdir nginx
mkdir scripts
mkdir workspace
mkdir documents
mkdir logs
mkdir templates
mkdir research_data
mkdir git_repos
mkdir models

REM .gitkeep 파일 생성
echo. > workspace\.gitkeep
echo. > documents\.gitkeep
echo. > logs\.gitkeep
echo. > templates\.gitkeep
echo. > research_data\.gitkeep
echo. > git_repos\.gitkeep
echo. > models\.gitkeep

REM 기본 아이콘 파일 생성 (빈 파일)
echo. > desktop-app\assets\icon.png
echo. > desktop-app\assets\icon.ico
echo. > desktop-app\assets\icon.icns

echo Project structure created successfully!