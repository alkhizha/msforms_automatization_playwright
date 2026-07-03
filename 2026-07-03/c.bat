@echo off
if [%1]==[] goto errorNoParams
node js\compile.js < %1 > "compiled_tests\Compiled(UTF-8) %~n1.txt"
copy /Y "compiled_tests\Compiled(UTF-8) %~n1.txt" "Compiled(UTF-8).txt"
goto :EOF
:errorNoParams
echo [1m[31mError: no params[0m
