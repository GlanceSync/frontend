# Deploying GlanceSync

Both repositories deploy on every push to `main` via GitHub Actions: the backend
ships a jar restarted by systemd, the frontend ships the built Angular SSR bundle
run by pm2. nginx sits in front of both.

```
                    nginx :80/:443
                   /              \
     /api/  /ws  ->               -> everything else
     backend :8083                   frontend :4000  (Angular SSR)
          |
     postgres :5440
```

`/api` and `/ws` must be served from the same origin as the app, or the session
cookie will not be sent with them — the WebSocket authenticates from that cookie.

## GitHub secrets

Set these in **both** repositories (Settings → Secrets and variables → Actions):

| Secret | Meaning |
|---|---|
| `SSH_HOST` | VPS hostname or IP |
| `SSH_USERNAME` | deploy user, e.g. `ubuntu` |
| `SSH_PASSWORD` | that user's password |
| `APP_HOST` | frontend repo only: the public hostname, e.g. `glancesync.app` |

`APP_HOST` is not cosmetic. Angular's SSR server refuses any `Host` header it does
not recognise, and it wants a hostname **without a port**. Get it wrong and every
page returns 400.

## One-time server setup

```bash
# 1. Runtimes
sudo apt update
sudo apt install -y openjdk-17-jre-headless nginx curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 2. Database (same image and ports as local development)
sudo apt install -y docker.io docker-compose-plugin
mkdir -p ~/glancesync-backend && cd ~/glancesync-backend
# copy docker-compose.yml and .env from the project, then:
docker compose up -d

# 3. Backend credentials: the service reads .env from its working directory
cp deploy/.env.example ~/glancesync-backend/.env
nano ~/glancesync-backend/.env          # set DB_PASSWORD, COOKIE_SECURE=true

# 4. Backend service
sudo cp deploy/glancesync-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable glancesync-backend

# 5. Let the deploy user restart it without a password prompt
echo "$USER ALL=(ALL) NOPASSWD: /bin/systemctl restart glancesync-backend.service" \
  | sudo tee /etc/sudoers.d/glancesync

# 6. nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/glancesync
sudo sed -i "s/your-domain/$YOUR_DOMAIN/" /etc/nginx/sites-available/glancesync
sudo ln -s /etc/nginx/sites-available/glancesync /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 7. TLS — also what makes video calls work, since getUserMedia needs a secure context
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d $YOUR_DOMAIN

# 8. Survive reboots
pm2 startup     # run the command it prints
pm2 save
```

Step 5 matters: without it the backend workflow hangs on a sudo password prompt.

## Rollback

Both workflows health-check after restarting and roll back on failure.

- **Backend** keeps `previous.jar`, polls `/api/auth/me` for up to a minute, and on
  failure restores the old jar and restarts. The JVM needs time to start, so a
  single check would report a false failure.
- **Frontend** keeps the previous directory, checks `/login` with the right `Host`
  header, and on failure restores and restarts.

## After deploying

Video and voice calls need **https**, so finish step 7. Over plain http the browser
does not expose the camera or microphone at all, and calls cannot start. Everything
else — chat, presence, notifications, dates — works either way.

Calls between people on different networks may also need a TURN server (coturn);
the public STUN server alone cannot traverse every NAT.
