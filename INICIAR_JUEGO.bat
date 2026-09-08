@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

set "ASFALTO_NODE_OVERRIDE=%ASFALTO_NODE%"
set "ASFALTO_NODE="

if defined ASFALTO_NODE_OVERRIDE call :try_node "%ASFALTO_NODE_OVERRIDE%"
if not defined ASFALTO_NODE call :try_node "%~dp0tools\node\node.exe"
if not defined ASFALTO_NODE for /f "delims=" %%N in ('where.exe node.exe 2^>nul') do if not defined ASFALTO_NODE call :try_node "%%~fN"
if not defined ASFALTO_NODE if defined NVM_SYMLINK call :try_node "%NVM_SYMLINK%\node.exe"
if not defined ASFALTO_NODE call :try_node "%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined ASFALTO_NODE call :try_node "%ProgramFiles%\nodejs\node.exe"
if not defined ASFALTO_NODE call :try_node "%ProgramFiles(x86)%\nodejs\node.exe"
if not defined ASFALTO_NODE call :try_node "%LOCALAPPDATA%\Volta\bin\node.exe"
if not defined ASFALTO_NODE call :try_node "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined ASFALTO_NODE for /d %%R in ("%USERPROFILE%\.cache\codex-runtimes\*") do if not defined ASFALTO_NODE call :try_node "%%~fR\dependencies\node\bin\node.exe"

if not defined ASFALTO_NODE (
  if defined ASFALTO_NODE_FOUND (
    echo Se encontro Node.js, pero ninguna version compatible con Node.js 20 o superior.
  ) else (
    echo No se encontro Node.js 20 o superior.
  )
  echo Instala Node.js 20 o copia node.exe en tools\node y vuelve a intentar.
  pause
  exit /b 1
)

if /i "%~1"=="--check-node" (
  echo NODE_CHECK_OK
  echo NODE_EXE=%ASFALTO_NODE%
  "%ASFALTO_NODE%" --version
  if errorlevel 1 exit /b 1
  exit /b 0
)

echo Iniciando Asfalto Nacional v6 por HTTP local...
"%ASFALTO_NODE%" "%~dp0tools\serve-local.mjs" --open --port-start 4173 --port-end 4183
set "ASFALTO_EXIT=%ERRORLEVEL%"
if not "%ASFALTO_EXIT%"=="0" echo El servidor no pudo iniciarse. Codigo: %ASFALTO_EXIT%
pause
exit /b %ASFALTO_EXIT%

:try_node
if defined ASFALTO_NODE exit /b 0
if "%~1"=="" exit /b 0
if not exist "%~1" exit /b 0
set "ASFALTO_NODE_FOUND=1"
"%~1" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" >nul 2>nul
if not errorlevel 1 set "ASFALTO_NODE=%~f1"
exit /b 0
