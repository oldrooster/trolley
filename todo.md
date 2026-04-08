
5. On main page once loaded (through caddy) these errors appear -IGNORE CLAUDE THIS IS INCASE I WANT TO FIX IT IN CLOUDFLARE
 ``` Go to Cloudflare Zero Trust → Access → Applications → trolley.cbf.nz
    Add a bypass rule (or "skip" policy) for these paths:
    /manifest.json
    /favicon.svg
    /favicon.ico
    /assets/*
    ```