#!/bin/bash
kill $(lsof -ti:${PORT:-3000}) 2>/dev/null && echo "[*] Stopped" || echo "[!] Not running"
