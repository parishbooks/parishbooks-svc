# Kong (local)

```bash
docker compose up -d kong
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/auth/jwks
```

Routes and global plugins (`correlation-id`, `file-log`, `rate-limiting`)
are defined in `kong.yml`. Upstreams target Nest services on the host via
`host.docker.internal` (see service ports in the repo root `.env`).

Reload config after editing `kong.yml`:

```bash
docker compose restart kong
```

Proxy: `http://localhost:8000` · Admin API: `http://localhost:8009`

Check plugins loaded:

```bash
curl -s http://localhost:8009/plugins | jq '.data[].name'
```
