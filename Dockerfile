# Base image: Official lightweight Nginx Alpine
FROM nginx:alpine

# Set default Cloud Run PORT (can be overridden by Cloud Run at runtime)
ENV PORT=8080

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy Nginx template (nginx docker entrypoint automatically runs envsubst on /etc/nginx/templates/*.template)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Copy web application assets
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY src /usr/share/nginx/html/src

# Expose standard Cloud Run port
EXPOSE 8080

# Cloud Run healthcheck (optional in Docker, Cloud Run performs HTTP probes)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/healthz || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
