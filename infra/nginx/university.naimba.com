# University — application (SPA statique)
server {
    server_name university.naimba.com;

    root /opt/apps/university/frontend/dist/pwa;
    index index.html;

    # En-têtes de sécurité (HSTS, nosniff, X-Frame-Options, Referrer-Policy).
    # Attention : un `add_header` dans un `location` annule TOUS ceux hérités
    # du `server`. Chaque location qui pose son propre `add_header` doit donc
    # ré-inclure ce snippet (voir plus bas).
    include /etc/nginx/snippets/university-securite.conf;

    # API NestJS (préfixe global « api ») : même backend que university-api.naimba.com.
    # Doit précéder le fallback SPA, sinon POST /api/* renvoie 405.
    client_max_body_size 25m;
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:5081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Téléchargement de l'APK Android.
    # Doit précéder le repli SPA : sans cette location,
    # /telechargement/university.apk renverrait l'application web.
    location ^~ /telechargement/ {
        alias /opt/apps/university/telechargement/;
        # Pas d'index de répertoire : on ne liste pas les fichiers publiés.
        autoindex off;
        # nginx ne connaît pas .apk (absent de /etc/nginx/mime.types) :
        # on déclare le type explicitement, sinon le fichier part en
        # application/octet-stream et certains telephones refusent l'install.
        types {
            application/vnd.android.package-archive apk;
        }
        default_type application/octet-stream;
        # Le fichier est proposé en téléchargement, pas affiché dans l'onglet.
        add_header Content-Disposition "attachment" always;
        # Un add_header ici annule ceux hérités du server : on ré-inclut le
        # snippet des en-têtes de sécurité (voir l'en-tête du fichier).
        include /etc/nginx/snippets/university-securite.conf;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    # L'index et le manifeste ne se mettent jamais en cache : après un
    # déploiement, un index périmé référence des fichiers qui n'existent plus.
    location = /index.html {
        expires -1;
        add_header Cache-Control "no-cache, must-revalidate";
        include /etc/nginx/snippets/university-securite.conf;
    }

    location = /manifest.json {
        expires -1;
        add_header Cache-Control "no-cache, must-revalidate";
        include /etc/nginx/snippets/university-securite.conf;
    }

    # Le service worker doit toujours être revalidé après un déploiement.
    location = /sw.js {
        try_files $uri =404;
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        include /etc/nginx/snippets/university-securite.conf;
    }

    location ~* \.(?:css|js|mjs|jpg|jpeg|gif|png|svg|ico|webp|woff|woff2)$ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
        include /etc/nginx/snippets/university-securite.conf;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml application/manifest+json;

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/university.naimba.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/university.naimba.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}

server {
    if ($host = university.naimba.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    listen [::]:80;
    server_name university.naimba.com;
    return 404; # managed by Certbot


}
