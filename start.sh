#!/bin/bash
cd "$(dirname "$0")"
nohup node server.js > server.log 2>&1 &
PID=$!
echo "[*] BotControl started (PID: $PID)"
sleep 3
if [ -f server-status.txt ]; then
  STATUS=$(cat server-status.txt)
  IP=$(echo $STATUS | cut -d: -f2)
  PORT=$(echo $STATUS | cut -d: -f3)
  echo "[*] Web: http://$IP:$PORT"
fi
echo "[*] tail -f server.log  # view logs"
