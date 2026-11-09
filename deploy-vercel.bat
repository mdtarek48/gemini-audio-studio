@echo off
title Deploy to Vercel
echo ====================================================
echo Deploying to Vercel (100%% Free Serverless Hosting)
echo ====================================================
echo.
echo Step 1: Logging in to Vercel...
call npx vercel login
echo.
echo Step 2: Deploying project...
call npx vercel --prod
echo.
echo ====================================================
echo Deployment complete!
echo ====================================================
pause

