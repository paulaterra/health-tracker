# Quadern de salut — versió Supabase

Aplicació HTML/CSS/JavaScript estàtica connectada a Supabase.

## Publicació gratuïta

Pots publicar la carpeta sencera a GitHub Pages, Cloudflare Pages o Netlify.
No necessita Node.js ni procés de compilació.

## Configuració Supabase utilitzada

El client és a `js/db/supabase.js` i utilitza només la clau pública.
Mai hi afegeixis una `secret key` o una clau `service_role`.

La base de dades necessita la taula `public.health_records` i les polítiques RLS creades durant la configuració.

## Prova local

Els mòduls JavaScript no funcionen obrint `index.html` amb doble clic. Executa un servidor local, per exemple:

```bash
python3 -m http.server 8080
```

I obre `http://localhost:8080`.

## Dades antigues

Quan iniciïs sessió, l'aplicació detectarà els registres antics d'IndexedDB i oferirà copiar-los a Supabase. La migració no elimina les dades locals.
