# NYU树洞（最小可运行版）

一个轻量匿名树洞：
- 匿名投稿（默认进入待审）
- 管理员审核（通过/隐藏/删除）
- 公开时间线（只展示已通过）
- 举报功能（已通过内容可举报）
- 基础防刷（同一 IP 15 秒冷却）
- 账号系统（注册 / 登录 / 登出，会话 Cookie）

## 运行

```powershell
# 可选：设置管理员口令
$env:ADMIN_TOKEN = "your-strong-token"

python app.py
```

打开：`http://127.0.0.1:8000`

## 管理员审核

1. 页面底部输入 `ADMIN_TOKEN`
2. 点击“加载待审”
3. 对每条内容执行通过 / 隐藏 / 删除

## 账号登录

- 现在默认需要登录后才能投稿（`REQUIRE_LOGIN_TO_POST=True`）
- 用户名规则：`3-24` 位，`字母/数字/下划线`
- 密码最少 `8` 位

## 数据存储

- SQLite 文件：`treehole.db`
- 表：`posts`

## 可调参数（在 `app.py` 顶部）

- `POST_COOLDOWN_SECONDS`：发帖冷却时间
- `MAX_CONTENT_LEN`：最大内容长度
- `PAGE_SIZE`：每次读取条数
- `HOST` / `PORT`：监听地址与端口

## 云服务器部署（Ubuntu，推荐）

以下步骤适合 Ubuntu 22.04/24.04。

1. 在云厂商安全组放行端口：`22`、`80`（后续上 HTTPS 还要 `443`）
2. 登录服务器并拉代码到任意目录（例如 `/root/hole`）
3. 在项目根目录执行：

```bash
sudo bash deploy/install_ubuntu.sh
```

4. 设置管理员口令：

```bash
sudo nano /etc/systemd/system/treehole.service
```

把 `Environment=ADMIN_TOKEN=change-this-token` 改成强口令，然后执行：

```bash
sudo systemctl daemon-reload
sudo systemctl restart treehole
sudo systemctl status treehole
```

5. 验证站点：

```bash
curl http://127.0.0.1:8000/api/posts
curl http://服务器公网IP/
```

### 绑定域名 + HTTPS（可选但建议）

1. 将域名 A 记录指向服务器公网 IP
2. 修改 `deploy/treehole.nginx.conf` 的 `server_name _;` 为你的域名
3. 重新加载 Nginx：

```bash
sudo cp deploy/treehole.nginx.conf /etc/nginx/sites-available/treehole
sudo nginx -t
sudo systemctl reload nginx
```

4. 申请证书：

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```
