@echo off
REM ProblemHunt: make this Windows PC your free web server (use with Cloudflare Tunnel).
REM Double-click once. It sets public-safe settings, auto-starts ProblemHunt at login, and stops the PC sleeping.
cd /d "%~dp0.."
set /p ADMIN=Your admin email (the account that will manage the site): 
findstr /b "PH_PUBLIC_MODE" .env >nul 2>&1 || echo PH_PUBLIC_MODE=1>> .env
findstr /b "PH_ADMIN_EMAIL" .env >nul 2>&1 || echo PH_ADMIN_EMAIL=%ADMIN%>> .env
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ProblemHunt.bat
> "%STARTUP%" echo @echo off
>> "%STARTUP%" echo cd /d "%CD%"
>> "%STARTUP%" echo start "ProblemHunt" /min python start_problemhunt.py --no-browser --port 8000
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
echo.
echo Done. ProblemHunt will start automatically when you log in to Windows.
echo Starting it now...
start "ProblemHunt" /min python start_problemhunt.py --no-browser --port 8000
pause
