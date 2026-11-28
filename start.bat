@echo off
REM SPDX-License-Identifier: Apache-2.0
rem Start LabTracer. Needs Python 3.8 or later (python.org or the Microsoft Store).
cd /d "%~dp0"
where py >nul 2>nul && (py -3 server.py %* & goto :eof)
where python >nul 2>nul && (python server.py %* & goto :eof)
echo Python 3 was not found. Install it from https://www.python.org/downloads/ and run this file again.
echo You can also open app\index.html directly (browser storage mode).
pause
