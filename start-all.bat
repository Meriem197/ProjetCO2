@echo off
title Systeme CO2 - Demarrage
color 0A

echo ================================================
echo    DEMARRAGE DU SYSTEME DE SURVEILLANCE CO2
echo ================================================
echo.

echo [1/3] Demarrage MySQL...
net start MySQL80
timeout /t 3 /nobreak >nul

echo [2/3] Demarrage InfluxDB...
net start influxdb
timeout /t 5 /nobreak >nul

echo [3/3] Mosquitto deja actif automatiquement
timeout /t 1 /nobreak >nul

echo.
echo ================================================
echo    SYSTEME PRET - Ouvrez votre navigateur sur :
echo    https://localhost:8080
echo ================================================
echo.

cd /d "C:\Users\Mariem\OneDrive - Ministere de l'Enseignement Superieur et de la Recherche Scientifique\Bureau\PFE\pfecode"
npm run dev:https
