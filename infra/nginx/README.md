# Vhosts Nginx

Les fichiers de ce dossier sont déployés sur `/etc/nginx/sites-available/` puis
activés par un symlink dans `/etc/nginx/sites-enabled/`. Les chemins `root`
(front) et `proxy_pass` (API) sont relatifs au déploiement :

```
/opt/apps/university/frontend/dist/pwa   # SPA Quasar build PWA
http://127.0.0.1:5081                   # NestJS (port par défaut, variable PORT du backend)
```

## Mise en place

```bash
sudo cp infra/nginx/university.naimba.com \
        infra/nginx/university-api.naimba.com \
        /etc/nginx/sites-available/

sudo ln -s /etc/nginx/sites-available/university.naimba.com \
          /etc/nginx/sites-enabled/university.naimba.com
sudo ln -s /etc/nginx/sites-available/university-api.naimba.com \
          /etc/nginx/sites-enabled/university-api.naimba.com

sudo certbot --nginx \
  -d university.naimba.com -d university-api.naimba.com \
  --non-interactive --agree-tos -m <email> --redirect

sudo nginx -t && sudo systemctl reload nginx
```

Les certificats sont émis par Let's Encrypt (`/etc/letsencrypt/live/university.naimba.com/`)
et renouvelés automatiquement par le timer certbot.

## Variables d'environnement backend (prod)

Dans `/opt/apps/university/backend/.env`, renseigner :

- `CORS_ORIGINS` — ajouter `https://university.naimba.com`
- `URL_APPLICATION=https://university.naimba.com` — base des QR et liens A4
- `OTP_GATEWAY_URL` / `OTP_API_KEY` — passerelle SMS locale
- `MOBILE_MONEY_URL` / `MOBILE_MONEY_API_KEY` (optionnel) — sinon simulation

## Build de la SPA pour la prod

```bash
cd /opt/apps/university/frontend
API_URL=https://university-api.naimba.com/api npm run build
```

L'instance Quasar écrit le bundle dans `dist/pwa`, que Nginx sert en statique.
