#!/bin/bash
# =============================================================
# deploy.sh — 手动部署备用脚本
# 当前主线：
# - GitHub Actions 是默认部署方式
# - 本脚本只作为手动兜底，不负责构建镜像
# - 服务器只拉 main 分支里的配置文件，然后 pull GHCR 镜像
# =============================================================

SERVER_IP="${SERVER_IP:-47.103.99.94}"
SERVER_USER="${SERVER_USER:-root}"
APP_DIR="/root/nyu-treehole"

echo "=========================================="
echo "  部署到 ${SERVER_USER}@${SERVER_IP}"
echo "=========================================="

# 检查 sshpass（用于密码登录），如果有 SSH 密钥则不需要
SSH_CMD="ssh -o StrictHostKeyChecking=no"

if [ -n "$SERVER_PASS" ]; then
  if ! command -v sshpass &> /dev/null; then
    echo "提示：未安装 sshpass，将使用 SSH 密钥。"
    echo "如需密码登录，请先运行: brew install sshpass (Mac) 或 apt install sshpass (Linux)"
  else
    SSH_CMD="sshpass -p '${SERVER_PASS}' ssh -o StrictHostKeyChecking=no"
  fi
fi

run_remote() {
  echo ""
  echo ">>> $1"
  eval "${SSH_CMD} ${SERVER_USER}@${SERVER_IP} \"$1\""
}

# ── 1. 拉取最新代码（main） ──────────────────────────────────
echo ""
echo "[1/4] 拉取最新代码..."
run_remote "cd ${APP_DIR} && git pull origin main 2>&1"

# ── 2. 拉取最新镜像并启动 ─────────────────────────────────────
echo ""
echo "[2/4] 拉取并启动（约 1-3 分钟）..."
run_remote "cd ${APP_DIR} && docker compose pull 2>&1 | tail -20"
run_remote "cd ${APP_DIR} && docker compose up -d 2>&1 | tail -20"

# ── 3. 等待数据库就绪，执行迁移 ──────────────────────────────
echo ""
echo "[3/4] 等待数据库就绪（30s）..."
sleep 30
run_remote "cd ${APP_DIR} && docker compose ps 2>&1"
run_remote "cd ${APP_DIR} && docker compose exec -T app npx prisma@6.19.2 migrate deploy 2>&1"
run_remote "cd ${APP_DIR} && docker compose exec -T app npx prisma@6.19.2 db seed 2>&1"

# ── 4. 验证 ───────────────────────────────────────────────────
echo ""
echo "[4/4] 验证..."
run_remote "curl -s -o /dev/null -w 'HTTP Status: %{http_code}' http://localhost/"
run_remote "cd ${APP_DIR} && docker compose logs app --tail=10 2>&1"

echo ""
echo "=========================================="
echo "  ✓ 部署完成！"
echo "  访问：http://${SERVER_IP}"
echo "  ⚠️  如果邮箱验证要真发邮件，请先确认服务器 .env 已配置 SMTP_* 变量"
echo "=========================================="
