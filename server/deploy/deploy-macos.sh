#!/bin/bash
# ==========================================
# Code Review Server - macOS Deploy Script
# ==========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "======================================"
echo " Code Review Server - macOS Deployment"
echo "======================================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed."
    echo "Install via Homebrew: brew install node"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "[ERROR] Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi
echo "[OK] Node.js $(node -v) found"

# Check MongoDB
if ! command -v mongod &> /dev/null && ! command -v mongosh &> /dev/null; then
    echo "[WARN] MongoDB is not detected locally."
    echo "Install via Homebrew: brew tap mongodb/brew && brew install mongodb-community"
    echo "Start: brew services start mongodb-community"
fi

# Install dependencies
echo "[*] Installing dependencies..."
cd "$SERVER_DIR"
npm install

# Build TypeScript
echo "[*] Building TypeScript..."
npm run build

# Create .env if not exists
if [ ! -f "$SERVER_DIR/.env" ]; then
    echo "[*] Creating .env from template..."
    cp "$SERVER_DIR/.env.example" "$SERVER_DIR/.env"
    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i '' "s/your-secret-key-change-this/$JWT_SECRET/" "$SERVER_DIR/.env"
    echo "[OK] .env created with random JWT secret"
    echo "[!] Please review and update $SERVER_DIR/.env"
fi

# Install pm2 if not available
if ! command -v pm2 &> /dev/null; then
    echo "[*] Installing pm2 globally..."
    npm install -g pm2
fi

# Start with pm2
echo "[*] Starting server with pm2..."
cd "$SERVER_DIR"
pm2 stop code-review-server 2>/dev/null || true
pm2 start dist/index.js --name code-review-server
pm2 save

echo ""
echo "======================================"
echo " Deployment Complete!"
echo "======================================"
echo " Server: http://localhost:3000"
echo " Health: http://localhost:3000/api/health"
echo ""
echo " Commands:"
echo "   pm2 status          - Check status"
echo "   pm2 logs            - View logs" 
echo "   pm2 restart all     - Restart"
echo "   pm2 stop all        - Stop"
echo "======================================"
