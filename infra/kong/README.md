# Kong (local)

```bash
docker compose up -d kong
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/auth/jwks
```

Routes are defined in `kong.yml`. Upstreams target Nest services on the
host via `host.docker.internal` (see service ports in the repo root `.env`).

Proxy: `http://localhost:8000` · Admin API: `http://localhost:8009`
