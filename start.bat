@echo off
set PORT=8787
set AUTH_TOKEN=KV123456
set MAX_MEMORY_MB=512
set ENABLE_CORS=true

echo Starting LiuKV with AUTH_TOKEN configured...
liukv.exe
pause
