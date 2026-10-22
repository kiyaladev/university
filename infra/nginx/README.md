# Vhosts Nginx

Les fichiers de ce dossier sont déployés sur `/etc/nginx/sites-available/` puis
activés par un symlink dans `/etc/nginx/sites-enabled/`. Les chemins `root`
(front) et `proxy_pass` (API) sont relatifs au déploiement :

```
/opt/apps/university/frontend/dist/pwa   # SPA Quasar build PWA
http://127.0.0.1:5081                   # NestJS en production : PORT=5081 (5031 = port de développement, cf. backend/.env.example)
```

## Mise en place

```bash
sudo cp infra/nginx/snippets/university-securite.conf /etc/nginx/snippets/
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

## Appliquer une modification en production

Le dépôt fait foi : on modifie d'abord `infra/nginx/`, puis on recopie. Les
fichiers du dépôt contiennent déjà les lignes « managed by Certbot » : les
copier tels quels ne casse pas le TLS.

```bash
cd /opt/apps/university

# 1. Voir ce qui va changer
diff -u /etc/nginx/sites-available/university.naimba.com     infra/nginx/university.naimba.com
diff -u /etc/nginx/sites-available/university-api.naimba.com infra/nginx/university-api.naimba.com

# 2. Sauvegarder, puis copier (vhosts + snippet des en-têtes de sécurité)
sudo cp /etc/nginx/sites-available/university.naimba.com{,.bak-$(date +%Y%m%d)}
sudo cp infra/nginx/snippets/university-securite.conf /etc/nginx/snippets/
sudo cp infra/nginx/university.naimba.com infra/nginx/university-api.naimba.com \
        /etc/nginx/sites-available/

# 3. Tester : en cas d'erreur, NE PAS recharger, restaurer la sauvegarde
sudo nginx -t

# 4. Recharger (sans coupure)
sudo systemctl reload nginx

# 5. Vérifier
curl -sI https://university.naimba.com/ | grep -iE 'strict-transport|x-frame|x-content|referrer'
```

`scripts/preflight-deploiement.cjs` signale (sans échouer) tout écart entre ces
fichiers et `/etc/nginx/sites-available/`.

### En-têtes de sécurité

Ils vivent dans `snippets/university-securite.conf` (déployé dans
`/etc/nginx/snippets/`). Un `add_header` posé dans un `location` annule tous
ceux hérités du `server` : chaque `location` qui a son propre `add_header`
ré-inclut donc le snippet. Toute nouvelle `location` avec `add_header` doit
faire de même. La CSP n'est qu'en commentaire dans le snippet : à éprouver
d'abord en `Content-Security-Policy-Report-Only`.

## Variables d'environnement backend (prod)

Dans `/opt/apps/university/backend/.env`, renseigner :

- `CORS_ORIGINS` — ajouter `https://university.naimba.com`
- `URL_APPLICATION=https://university.naimba.com` — base des QR et liens A4
- `OTP_GATEWAY_URL` / `OTP_API_KEY` — passerelle SMS locale
- `MOBILE_MONEY_URL` / `MOBILE_MONEY_API_KEY` (optionnel) — sinon simulation

## Build de la SPA pour la prod

```bash
cd /opt/apps/university/frontend
API_URL=https://university-api.naimba.com/api bun run build
```

L'instance Quasar écrit le bundle dans `dist/pwa`, que Nginx sert en statique.
