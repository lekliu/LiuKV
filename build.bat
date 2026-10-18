@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

if "%1"=="local" goto build_local
if "%1"=="docker" goto build_docker
if "%1"=="export" goto export_docker
if "%1"=="all" goto build_all
if "%1"=="test" goto run_test

:menu
cls
echo ========================================================
echo                 LiuKV Build Tool
echo ========================================================
echo   [1] Local Build : Compile Web UI + Build liukv.exe
echo   [2] Docker Build: Build Docker Image (liukv:latest)
echo   [3] Docker Export: Build and Export to tar archive
echo   [4] Run Tests   : Execute Go Unit Tests
echo   [5] Build All   : Web UI + liukv.exe + Docker Image
echo   [0] Exit
echo ========================================================
set /p choice="Select an option [0-5]: "

if "%choice%"=="1" goto build_local
if "%choice%"=="2" goto build_docker
if "%choice%"=="3" goto export_docker
if "%choice%"=="4" goto run_test
if "%choice%"=="5" goto build_all
if "%choice%"=="0" exit /b 0
echo Invalid choice.
pause
goto menu

:build_web
echo.
echo === [Step 1] Building Web UI (React + Tailwind) ===
cd /d "%ROOT_DIR%web"
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed!
        cd /d "%ROOT_DIR%"
        exit /b 1
    )
)
echo Building frontend dist...
call npm run build
if errorlevel 1 (
    echo [ERROR] npm run build failed!
    cd /d "%ROOT_DIR%"
    exit /b 1
)
cd /d "%ROOT_DIR%"
echo Frontend build succeeded!
exit /b 0

:build_local
call :build_web
if errorlevel 1 goto error

echo.
echo === [Step 2] Building Go Binary (liukv.exe) ===
set CGO_ENABLED=0
go build -ldflags="-s -w" -o liukv.exe main.go
if errorlevel 1 (
    echo [ERROR] Go build failed!
    goto error
)
echo.
echo [SUCCESS] Binary generated: %ROOT_DIR%liukv.exe
echo.
pause
goto menu

:build_docker
echo.
echo === [Step] Building Docker Image ===
docker build -t liukv:latest .
if errorlevel 1 (
    echo [ERROR] Docker build failed!
    goto error
)
echo.
echo [SUCCESS] Docker image created: liukv:latest
echo.
pause
goto menu

:export_docker
call :build_docker_silent
if errorlevel 1 goto error

echo.
echo === [Step] Exporting Docker Image to tar ===
docker save -o "%ROOT_DIR%liukv-latest.tar" liukv:latest
if errorlevel 1 (
    echo [ERROR] Docker save failed!
    goto error
)
echo.
echo [SUCCESS] Image saved to: %ROOT_DIR%liukv-latest.tar
echo.
pause
goto menu

:build_docker_silent
echo.
echo === [Step] Building Docker Image ===
docker build -t liukv:latest .
exit /b %errorlevel%

:run_test
echo.
echo === [Step] Running Go Tests ===
go test -v ./...
if errorlevel 1 (
    echo [WARNING] Some tests failed!
) else (
    echo [SUCCESS] All tests passed!
)
echo.
pause
goto menu

:build_all
call :build_web
if errorlevel 1 goto error

echo.
echo === [Step 2] Building Go Binary (liukv.exe) ===
set CGO_ENABLED=0
go build -ldflags="-s -w" -o liukv.exe main.go
if errorlevel 1 goto error

call :build_docker_silent
if errorlevel 1 goto error

echo.
echo ========================================================
echo [ALL FINISHED]
echo 1. Binary: %ROOT_DIR%liukv.exe
echo 2. Docker: liukv:latest
echo ========================================================
echo.
pause
goto menu

:error
echo.
echo [FAILED] Build failed, please check errors above.
echo.
pause
goto menu
