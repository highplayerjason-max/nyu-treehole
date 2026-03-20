#!/bin/bash
# =============================================================
# server-setup.sh — 服务器首次初始化脚本（只需运行一次）
# 用法：ssh root@你的IP 'bash -s' < deploy/server-setup.sh
# 当前主线：
# - GitHub 默认 / 唯一上线分支：main
# - 服务器项目目录：/root/nyu-treehole
# - 线上部署方式：GitHub Actions 构建 GHCR 镜像，服务器只负责 pull + up
# =============================================================
set -e

echo "=========================================="
echo "  NYU树洞 — 服务器初始化"
echo "=========================================="

# ── 1. 添加 2GB Swap（防止构建 OOM）──────────────────────────
echo ""
echo "[1/5] 配置 Swap..."
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  ✓ 2GB Swap 已创建"
else
  echo "  ✓ Swap 已存在，跳过"
fi

# ── 2. 安装 Docker ────────────────────────────────────────────
echo ""
echo "[2/5] 安装 Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "  ✓ Docker 安装完成"
else
  echo "  ✓ Docker 已安装，跳过"
fi

# ── 3. 配置国内 Docker 镜像加速 ──────────────────────────────
echo ""
echo "[3/5] 配置 Docker 镜像加速..."
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
EOF
systemctl daemon-reload
systemctl restart docker
echo "  ✓ 镜像加速配置完成"

# ── 4. 克隆代码 ───────────────────────────────────────────────
echo ""
echo "[4/5] 克隆代码..."
APP_DIR="/root/nyu-treehole"
REPO_URL="https://github.com/highplayerjason-max/nyu-treehole.git"

if [ ! -d "${APP_DIR}" ]; then
  git clone --branch main "${REPO_URL}" "${APP_DIR}"
  echo "  ✓ 代码克隆完成"
else
  cd "${APP_DIR}" && git pull origin main
  echo "  ✓ 代码已是最新"
fi

# ── 5. 配置环境变量 ───────────────────────────────────────────
echo ""
echo "[5/5] 配置环境变量..."
cd "${APP_DIR}"

if [ ! -f .env ]; then
  cp .env.example .env

  # 自动生成随机 AUTH_SECRET
  SECRET=$(openssl rand -hex 32)
  sed -i "s|change-this-to-a-random-secret-in-production|${SECRET}|g" .env

  # 设置生产数据库密码
  DB_PASS=$(openssl rand -hex 16)
  sed -i "s|postgresql://postgres:postgres@|postgresql://postgres:${DB_PASS}@|g" .env

  # 更新 AUTH_URL 为服务器 IP（如果还没有域名，先用 IP 跑）
  SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
  sed -i "s|http://localhost:3000|http://${SERVER_IP}|g" .env

  echo "  ✓ .env 已生成（AUTH_SECRET 和 DB 密码已随机化）"
  echo ""
  echo "  ⚠️  请检查 ${APP_DIR}/.env 并按需修改："
  echo "     - AUTH_URL=http://${SERVER_IP} 或你的正式域名"
  echo "     - EMAIL_DELIVERY_MODE=log（开发/调试）或 smtp（生产）"
  echo "     - SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASSWORD / SMTP_FROM"
  echo "     - LLM_MODERATION_PROVIDER=deepseek"
  echo "     - LLM_MODERATION_API_KEY=你的Key"
  echo "  ⚠️  脚本不会打印 .env 内容，避免把密钥直接暴露到终端日志"
else
  echo "  ✓ .env 已存在，跳过"
fi

echo ""
echo "=========================================="
echo "  初始化完成！现在运行："
echo "  cd ${APP_DIR}"
echo "  docker compose pull"
echo "  docker compose up -d"
echo "  sleep 30 && docker compose exec -T app npx prisma migrate deploy"
echo "  docker compose exec -T app npx prisma db seed"
echo "=========================================="
