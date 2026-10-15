@echo off
chcp 65001 >nul
title Converter artes do CorelDRAW (.cdr) para PDF
rem ==================================================================
rem  Converte TODOS os arquivos .cdr de uma pasta (e subpastas) em PDF,
rem  sem precisar do CorelDRAW. Usa o LibreOffice (gratuito).
rem
rem  Como usar:
rem   1. Instale o LibreOffice: https://pt-br.libreoffice.org/baixe-ja/
rem   2. Arraste a PASTA das artes para cima deste arquivo
rem      (ou copie este arquivo para dentro da pasta e de dois cliques).
rem   3. Cada .pdf e salvo ao lado do .cdr, na mesma pasta (o tema continua).
rem   4. No tablet: Administrador > Artes > Escolher uma pasta (ou .ZIP).
rem      O app usa o PDF e ignora o .cdr de mesmo nome.
rem ==================================================================

set "SOFFICE="
if exist "%ProgramFiles%\LibreOffice\program\soffice.exe" set "SOFFICE=%ProgramFiles%\LibreOffice\program\soffice.exe"
if exist "%ProgramFiles(x86)%\LibreOffice\program\soffice.exe" set "SOFFICE=%ProgramFiles(x86)%\LibreOffice\program\soffice.exe"
if not defined SOFFICE (
  echo.
  echo  O LibreOffice nao foi encontrado neste computador.
  echo  Instale de graca em: https://pt-br.libreoffice.org/baixe-ja/
  echo  Depois rode este arquivo de novo.
  echo.
  start "" "https://pt-br.libreoffice.org/baixe-ja/"
  pause
  exit /b 1
)

set "ORIGEM=%~1"
if "%ORIGEM%"=="" set "ORIGEM=%~dp0"
if "%ORIGEM:~-1%"=="\" set "ORIGEM=%ORIGEM:~0,-1%"
if not exist "%ORIGEM%\" (
  echo Pasta nao encontrada: %ORIGEM%
  pause
  exit /b 1
)

set /a OK=0, PULADOS=0, ERROS=0
set "LOG=%ORIGEM%\cdr-nao-convertidos.txt"
if exist "%LOG%" del "%LOG%"

echo.
echo  Convertendo os arquivos .cdr de:
echo  %ORIGEM%
echo  (feche o LibreOffice se ele estiver aberto)
echo.

for /r "%ORIGEM%" %%F in (*.cdr) do call :converter "%%F"

echo.
echo  ------------------------------------------
echo   Convertidos: %OK%
echo   Ja tinham PDF (pulados): %PULADOS%
echo   Nao convertidos: %ERROS%
if %ERROS% GTR 0 echo   Lista dos que falharam: %LOG%
echo  ------------------------------------------
echo  Agora importe a pasta no tablet (Administrador ^> Artes).
echo.
pause
exit /b 0

:converter
if exist "%~dpn1.pdf" (
  set /a PULADOS+=1
  goto :eof
)
echo  - %~nx1
"%SOFFICE%" --headless --convert-to pdf --outdir "%~dp1." "%~1" >nul 2>&1
if exist "%~dpn1.pdf" (
  set /a OK+=1
) else (
  set /a ERROS+=1
  echo %~1>>"%LOG%"
  echo     nao foi possivel converter este arquivo
)
goto :eof
