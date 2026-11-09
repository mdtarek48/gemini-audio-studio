@echo off
title Deploy to Firebase Hosting
echo ====================================================
echo Deploying to Firebase Hosting
echo ====================================================
echo.
echo Step 1: Re-authenticating with Google / Firebase...
call firebase login --reauth
echo.
echo Step 2: Deploying static files to Firebase Hosting...
call firebase deploy --only hosting
echo.
pause

