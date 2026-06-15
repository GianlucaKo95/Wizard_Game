

## Repo-Struktur

```
```

## Setup


- Edge Function deployen:
  ```bash
  npx supabase functions deploy game-action --project-ref DEIN-REF
  ```

### 2. GitHub Secrets setzen

| Secret | Wert |
|--------|------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon Key aus Supabase Settings |

### 3. HA Add-on installieren

- Konfiguration:
  ```yaml
  supabase_anon_key: dein-anon-key
  ```


