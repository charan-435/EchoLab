$echoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
python -m http.server 8765 --bind 127.0.0.1 --directory (Join-Path $echoRoot 'docs')

