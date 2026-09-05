#!/bin/bash
# Sahara — SIH26094 Prototype
# Single command: bash start.sh
# Access from any laptop on the same WiFi:
#   http://<YOUR_IP>:5173

# Use the locally installed Node if it exists (dev machine); otherwise fall back to whatever node is on PATH.
NODE_DIR="/c/Users/o26sh/AppData/Local/Programs/node-v22.18.0-win-x64"
[ -d "$NODE_DIR" ] && export PATH="$NODE_DIR:$PATH"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║  Sahara — SIH26094 Prototype             ║"
echo "  ║  AI-Powered Mental Health Monitoring     ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# Get local IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

# Start API server
echo "  Starting API server on port 3001..."
cd "$DIR"
node server/src/index.js &
API_PID=$!
sleep 2

# Start Vite dev server
echo "  Starting client on port 5173..."
cd "$DIR/client"
npx vite --host 0.0.0.0 --port 5173 &
VITE_PID=$!
sleep 3

echo ""
echo "  ════════════════════════════════════════════"
echo "  SERVERS RUNNING"
echo "  ════════════════════════════════════════════"
echo ""
echo "  This laptop:  http://localhost:5173"
echo "  Other laptops: http://$LOCAL_IP:5173"
echo ""
echo "  Roles:"
echo "    Laptop 1 → Victim (Safe Entry)"
echo "    Laptop 2 → Counsellor (Enter)"
echo "    Laptop 3 → Admin (Enter Analytics)"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo "  ════════════════════════════════════════════"
echo ""

# Wait for Ctrl+C
trap "echo ''; echo '  Stopping servers...'; kill $API_PID $VITE_PID 2>/dev/null; echo '  Done.'; exit 0" INT TERM
wait
