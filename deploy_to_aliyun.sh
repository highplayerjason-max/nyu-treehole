#!/usr/bin/env bash
set -e

# Configuration
SERVER_IP="121.43.247.184"
SERVER_USER="root"
REMOTE_DIR="/root/nyutreeh"
SSH_KEY="Key.pem"
ADMIN_TOKEN="secret123"
# Use the API key from environment or fallback to hardcoded (for demo)
AI_MODERATION_API_KEY="${AI_MODERATION_API_KEY:-sk-7Faibu12aAKWQMPhUGqA311k1jSnVxWtzY4tZgmSgdpYvtGP}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying to Aliyun...${NC}"

# Check for SSH Key
SSH_CMD="ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no"
if [ -n "$SSH_KEY" ]; then
    if [ -f "$SSH_KEY" ]; then
        SSH_CMD="$SSH_CMD -i $SSH_KEY"
        echo -e "${GREEN}🔑 Using SSH Key: $SSH_KEY${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: SSH key '$SSH_KEY' not found.${NC}"
        echo -e "${YELLOW}   Trying default SSH authentication (password or agent)...${NC}"
        # Clear SSH_KEY variable so we don't try to use it
        SSH_KEY=""
    fi
fi

# 1. Check Connection
echo -e "${YELLOW}📡 Checking connection to $SERVER_USER@$SERVER_IP...${NC}"
if ! $SSH_CMD "$SERVER_USER@$SERVER_IP" "echo 'Connection OK'" &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to $SERVER_USER@$SERVER_IP${NC}"
    echo "Reason: Permission denied, timeout, or bad configuration."
    echo "--------------------------------------------------------"
    echo "1. Edit this script to set SERVER_IP and SSH_KEY."
    echo "2. Ensure your public key is on the server (ssh-copy-id)."
    echo "3. Ensure the server firewall allows port 22."
    echo "--------------------------------------------------------"
    exit 1
fi
echo -e "${GREEN}✅ Connection successful!${NC}"

# 2. Sync Files
echo -e "${YELLOW}📦 Syncing files...${NC}"
rsync -avz -e "$SSH_CMD" \
    --exclude '.git' \
    --exclude 'venv' \
    --exclude '__pycache__' \
    --exclude '*.db' \
    --exclude '*.db-wal' \
    --exclude '*.db-shm' \
    --exclude '.DS_Store' \
    . "$SERVER_USER@$SERVER_IP:$REMOTE_DIR"

# 3. Configure & Run on Server
echo -e "${YELLOW}🔧 Configuring server and building Docker image...${NC}"
$SSH_CMD "$SERVER_USER@$SERVER_IP" "bash -s" <<EOF
    set -e
    
    # --- Docker Installation ---
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        if command -v yum &> /dev/null; then
            yum install -y docker || yum install -y docker-ce
            systemctl enable --now docker
        else
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
        fi
    fi

    # --- Docker Mirror Configuration (China) ---
    mkdir -p /etc/docker
    if [ ! -f /etc/docker/daemon.json ]; then
        echo "Configuring Docker daemon mirror..."
        cat > /etc/docker/daemon.json <<DOCKERCONF
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://mirror.ccs.tencentyun.com"
  ]
}
DOCKERCONF
        systemctl restart docker
    fi

    cd $REMOTE_DIR

    # --- Build Image ---
    echo "🐳 Building Docker image..."
    docker build -t treehole .

    # --- Manage Container ---
    if [ "\$(docker ps -q -f name=treehole_app)" ]; then
        echo "Stopping existing container..."
        docker stop treehole_app
        docker rm treehole_app
    fi
    if [ "\$(docker ps -aq -f name=treehole_app)" ]; then
        docker rm treehole_app
    fi

    # --- Run Container ---
    echo "🚀 Starting new container..."
    mkdir -p /data/treehole_data
    docker run -d \\
        --name treehole_app \\
        --restart unless-stopped \\
        -p 80:8000 \\
        -v /data/treehole_data:/data \\
        -e ADMIN_TOKEN="$ADMIN_TOKEN" \\
        -e AI_MODERATION_API_KEY="$AI_MODERATION_API_KEY" \\
        treehole

    echo "--------------------------------------------------------"
    echo "✅ Deployment complete!"
    echo "🌎 App URL: http://$SERVER_IP"
    echo "--------------------------------------------------------"
EOF

