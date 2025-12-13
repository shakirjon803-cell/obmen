#!/bin/bash
# Deploy script for NellX Bot on VPS

set -e

echo "🚀 Deploying NellX..."

# Navigate to project directory
cd /root/obmen

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

# Build frontend
echo "🔨 Building frontend..."
cd client
npm install
npm run build
cd ..

# Restart the service
echo "🔄 Restarting service..."
sudo systemctl restart nellx

echo "✅ Deploy complete!"
