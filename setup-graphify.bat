@echo off
echo ========================================
echo  Graphify Setup Script
echo ========================================
echo.

echo [1/5] Checking Python...
python --version
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.10+ from python.org
    pause
    exit /b 1
)

echo.
echo [2/5] Installing graphifyy...
pip install graphifyy
if errorlevel 1 (
    echo ERROR: pip install failed
    pause
    exit /b 1
)

echo.
echo [3/5] Installing Trae integration...
graphify install --platform trae
graphify trae install

echo.
echo [4/5] Creating .graphifyignore...
(
echo node_modules/
echo .next/
echo dist/
echo build/
echo vendor/
echo storage/
echo .git/
echo *.log
) > .graphifyignore
echo Created .graphifyignore

echo.
echo [5/5] Building initial graph...
graphify .

echo.
echo ========================================
echo  Done! Graph is in graphify-out/
echo  Open graphify-out/graph.html to view
echo ========================================
pause