# University — application (SPA statique)
server {
    server_name university.naimba.com;

    root /opt/apps/university/frontend/dist/pwa;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # L'index et le manifeste ne se mettent jamais en cache : après un
    # déploiement, un index périmé référence des fichiers qui n'existent plus.
    location = /index.html {
        expires -1;
        add_header Cache-Control "no-cache, must-revalidate";
    }

    location = /manifest.json {
        expires -1;
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # Le service worker doit toujours être revalidé après un déploiement.
    location = /sw.js {
        try_files $uri =404;
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location ~* \.(?:css|js|mjs|jpg|jpeg|gif|png|svg|ico|webp|woff|woff2)$ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

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
