@echo off
title Deploy LeadGuard to Vercel
echo ===================================================
echo     DEPLOYING LEADGUARD FRONTEND TO VERCEL
echo ===================================================
echo.
cd /d "%~dp0frontend"
echo [1/2] Verifying production build...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Production build failed. Please check errors above.
    pause
    exit /b %errorlevel%
)
echo.
echo [2/2] Deploying to Vercel...
echo (If this is your first time, log in via your browser when prompted)
echo.
call npx -y vercel --prod
echo.
echo ===================================================
echo Deployment completed! Check your live Vercel URL above.
echo ===================================================
pause
