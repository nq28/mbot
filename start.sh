#!/bin/bash
cd "$(dirname "$0")"
node server.js > server.log 2>&1 &
PID=$!
echo "[*] BotControl started (PID: $PID)"
sleep 2
cat server-status.txt 2>/dev/null || echo "[*] Check 'server.log' for details"
echo "[*] Web URL: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):${PORT:-3000}"
echo "[*] Run './status.sh' anytime to see the URL"
