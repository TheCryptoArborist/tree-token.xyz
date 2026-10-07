@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 "%~dp0tree_runtime_setup.py"
) else (
  python "%~dp0tree_runtime_setup.py"
)
if errorlevel 1 (
  echo.
  echo Setup could not start. Python 3.10 or later with Tkinter is required.
  echo No credentials need to be sent in chat.
  pause
)
endlocal
