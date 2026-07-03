@echo off
set PROFILE=%USERPROFILE%\pw-edge-forms-profile

start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="%PROFILE%" ^
  --no-first-run ^
  --no-default-browser-check

echo Edge started with CDP on http://127.0.0.1:9222
pause
