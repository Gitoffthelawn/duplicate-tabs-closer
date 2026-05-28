@ECHO OFF
powershell -ExecutionPolicy Bypass -File "%~dp0build.ps1" %*
PAUSE