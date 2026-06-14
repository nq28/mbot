#!/bin/bash
cd "$(dirname "$0")"
if [ -f server-status.txt ]; then
  STATUS=$(cat server-status.txt)
  echo "[*] Status: $STATUS"
  echo "[*] URL:    http://$(echo $STATUS | cut -d: -f2):$(echo $STATUS | cut -d: -f3)"
else
  echo "[!] Server not running"
fi
