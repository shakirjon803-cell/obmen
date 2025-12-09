@echo off
title NellX SSH Tunnel
color 0A

echo.
echo =============================================
echo    NellX SSH Tunnel - localhost.run
echo =============================================
echo.
echo IMPORTANT: Copy the URL that appears!
echo Update .env file with new WEBAPP_URL
echo.

:start
ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=no -R 80:127.0.0.1:8080 nokey@localhost.run

echo.
echo Reconnecting in 5 seconds...
timeout /t 5 /nobreak >nul
goto start
