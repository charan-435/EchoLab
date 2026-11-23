$echoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
python -m http.server 8765 --bind 127.0.0.1 --directory $echoRoot
Write-Host "Open: http://127.0.0.1:8765/code/ in your browser"
