# Security Notes — Service Role Key Handling

- Do NOT commit your `SUPABASE_SERVICE_ROLE_KEY` or any service role / admin keys to source control.
- Use your hosting platform's secret manager to store `SUPABASE_SERVICE_ROLE_KEY` and other secrets:
  - Render: Dashboard -> Environment -> Add Secret (key: `SUPABASE_SERVICE_ROLE_KEY`)
  - Netlify: Site Settings -> Build & deploy -> Environment -> add variable (key: `SUPABASE_SERVICE_ROLE_KEY`)
  - GitHub Actions: Repository -> Settings -> Secrets -> Actions -> add secret

- For local development, keep a private `.env.local` (ignored by `.gitignore`) and never push it. Prefer using a local secret store.
- Rotate the service role key regularly. If a key was shared accidentally, rotate it immediately from the Supabase dashboard.

Example (Render):

1. Go to your Render service -> Environment -> Add Environment Variable
2. Key: `SUPABASE_SERVICE_ROLE_KEY`
3. Value: <paste service role key>
4. Redeploy service

This ensures uploads to Supabase Storage can be performed server-side without exposing privileged keys in the browser or repository.
