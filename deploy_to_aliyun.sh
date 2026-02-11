#!/usr/bin/env bash
set -e

# Server Details
SERVER_IP="121.43.247.184"
SERVER_USER="root"
REMOTE_DIR="/root/nyutreeh"
# Optional: Path to your private key (e.g., "my-key.pem"). Leave empty to use default ~/.ssh/id_rsa
SSH_KEY="Key.pem"

SSH_CMD="ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no"
if [ -n "$SSH_KEY" ]; then
    if [ -f "$SSH_KEY" ]; then
        SSH_CMD="$SSH_CMD -i $SSH_KEY"
    else
        echo "⚠️  Warning: SSH key '$SSH_KEY' not found. Trying default SSH authentication..."
    fi
fi

echo "🚀 Deploying to Aliyun ($SERVER_IP)..."

# 1. Check if we can connect (simple check)
echo "Checking connection..."
if ! $SSH_CMD "$SERVER_USER@$SERVER_IP" "echo 'Connection OK'"; then
    echo "❌ Cannot connect to $SERVER_USER@$SERVER_IP"
    echo "Reason: Permission denied or timeout."
    echo "--------------------------------------------------------"
    echo "1. If you have a .pem file, edit this script and set SSH_KEY='path/to/key.pem'"
    echo "2. If you have a password, you must enable PasswordAuthentication on the server first,"
    echo "   OR use 'ssh-copy-id' to upload your public key."
    echo "   (Your public key is at ~/.ssh/id_ed25519.pub)"
    echo "--------------------------------------------------------"
    exit 1
fi

# 2. Sync files to the server
echo "📦 Syncing files..."
# Exclude local virtualenvs, git history, and local databases
# We use -e to specify the ssh command with key
rsync -avz -e "$SSH_CMD" --exclude '.git' --exclude 'venv' --exclude '__pycache__' --exclude '*.db' --exclude '*.db-wal' --exclude '*.db-shm' . "$SERVER_USER@$SERVER_IP:$REMOTE_DIR"

# 3. Run setup on the server
echo "🔧 Configuring server..."
$SSH_CMD "$SERVER_USER@$SERVER_IP" "bash -s" <<EOF
    set -e
    
    # Install Docker if not installed
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        # Try yum (for Alibaba Cloud Linux / CentOS)
        if command -v yum &> /dev/null; then
            echo "Detected yum, installing docker via yum..."
            yum install -y docker || yum install -y docker-ce
            # Start docker service if it exists (Podman doesn't use a daemon by default)
            if systemctl list-unit-files | grep -q docker.service; then
                systemctl enable --now docker
            fi
        else
            # Fallback to get-docker.sh for Ubuntu/Debian
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
        fi
    fi

    # Configure Podman/Docker mirror for China to fix pull timeouts
    if [ -d /etc/containers ]; then
        echo "🔧 Configuring Podman Mirror..."
        cat > /etc/containers/registries.conf <<CONF
unqualified-search-registries = ["docker.io"]

[[registry]]
prefix = "docker.io"
location = "docker.io"

[[registry.mirror]]
location = "docker.m.daocloud.io"
CONF
    fi

    cd $REMOTE_DIR

    # Build the image
    echo "🐳 Building Docker image..."
    docker build -t treehole .

    # Stop and remove existing container if running
    if [ "\$(docker ps -q -f name=treehole_app)" ]; then
        docker stop treehole_app
        docker rm treehole_app
    fi
    # Also remove stopped container if it exists
    if [ "\$(docker ps -aq -f name=treehole_app)" ]; then
        docker rm treehole_app
    fi

    # Run the new container
    # -d: Detached
    # --restart unless-stopped: Auto-restart on crash/reboot
    # -p 80:8000: Map port 80 (HTTP) to internal 8000
    # -v /data/treehole_data:/data: Persist database to host directory
    # -e ADMIN_TOKEN=...: Set your admin token here!
    
    echo "🚀 Starting container..."
    mkdir -p /data/treehole_data
    docker run -d \
        --name treehole_app \
        --restart unless-stopped \
        -p 80:8000 \
        -v /data/treehole_data:/data \
        -e ADMIN_TOKEN="secret123" \
        -e AI_MODERATION_API_KEY="sk-7Faibu12aAKWQMPhUGqA311k1jSnVxWtzY4tZgmSgdpYvtGP" \
        treehole

    echo "✅ Deployment complete!"
    echo "🌎 Visit: http://$SERVER_IP"
EOF
