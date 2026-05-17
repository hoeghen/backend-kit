@echo off
echo Starting E2E test server...
start http://localhost:3000/e2e-test.html
npx serve . -l 3000
