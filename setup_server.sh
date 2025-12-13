#!/bin/bash
# Initial server setup for NellX Bot
# Run this script on fresh VPS

set -e

echo "🔧 Setting up NellX on VPS..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "📥 Installing required packages..."
apt install -y python3 python3-pip python3-venv git nodejs npm nginx

# Clone repository
echo "📂 Cloning repository..."
cd /root
if [ -d "obmen" ]; then
    echo "Directory exists, pulling latest..."
    cd obmen
    git pull origin main
else
    git clone https://github.com/shakirjon803-cell/obmen.git
    cd obmen
fi

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip3 install -r requirements.txt

# Build frontend
echo "🔨 Building frontend..."
cd client
npm install
npm run build
cd ..

# Copy service file
echo "⚙️ Setting up systemd service..."
cp nellx.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable nellx

# Setup Nginx reverse proxy
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/nellx << 'EOF'
server {
    listen 80;
    server_name vm3739264.firstbyte.club 185.195.25.10;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
EOF

ln -sf /etc/nginx/sites-available/nellx /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo "✅ Setup complete!"
echo ""
echo "📌 Next steps:"
echo "1. Copy .env file to /root/obmen/.env"
echo "2. Start service: sudo systemctl start nellx"
echo "3. Check status: sudo systemctl status nellx"
echo "4. View logs: journalctl -u nellx -f"
