@echo off
rem alloffice launcher for the packaged Windows app: <install>\resources\cli\alloffice.cmd
setlocal
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\..\AllOffice.exe" "%~dp0genoffice.cjs" %*
endlocal
