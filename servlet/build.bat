@echo off
rem Builds campusnex.war without Maven (Windows). Needs JDK 17+ and Tomcat 10.1+.
rem Usage:  build.bat "C:\apache-tomcat-10.1.x"     (use a folder path without spaces)
if "%~1"=="" (
  echo Usage: build.bat "C:\path\to\apache-tomcat-10.1.x"
  exit /b 1
)
set "SERVLET_JAR=%~1\lib\servlet-api.jar"
if not exist "%SERVLET_JAR%" (
  echo servlet-api.jar not found in %~1\lib
  exit /b 1
)
set "HERE=%~dp0"
set "OUT=%HERE%target"
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\war\WEB-INF\classes"
dir /s /b "%HERE%src\main\java\*.java" > "%OUT%\sources.txt"
javac --release 17 -encoding UTF-8 -cp "%SERVLET_JAR%" -d "%OUT%\war\WEB-INF\classes" @"%OUT%\sources.txt" || exit /b 1
copy "%HERE%src\main\webapp\WEB-INF\web.xml" "%OUT%\war\WEB-INF\" >nul
for %%F in (index.html dashboard.html style.css script.js config.js) do copy "%HERE%..\%%F" "%OUT%\war\" >nul
xcopy "%HERE%..\assets" "%OUT%\war\assets\" /E /I /Q >nul
pushd "%OUT%\war"
jar cf "%OUT%\campusnex.war" .
popd
echo Built: %OUT%\campusnex.war
