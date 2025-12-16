#!/bin/bash
# Server setup script for VPS deployment

set -e

echo "=== Installing system dependencies ==="
apt update
apt install -y python3 python3-pip python3-venv git nodejs npm

echo "=== Setting up project directory ==="
cd /root
if [ -d "obmen" ]; then
    echo "Updating existing repo..."
    cd obmen
    git pull origin main
else
    echo "Cloning repository..."
    git clone https://github.com/shakirjon803-cell/obmen.git
    cd obmen
fi

echo "=== Setting up Python virtual environment ==="
python3 -m venv venv
source venv/bin/activate

echo "=== Installing Python dependencies ==="
pip install --upgrade pip
pip install aiohttp aiogram apscheduler python-dotenv aiosqlite httpx

echo "=== Building frontend ==="
cd client
npm install
npm run build
cd ..

echo "=== Setup complete! ==="
echo "To start the bot, run:"
echo "cd /root/obmen && source venv/bin/activate && python main.py"
