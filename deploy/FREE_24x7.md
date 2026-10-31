# ProblemHunt free 24/7 hosting (no credit card)

Render (free web service) runs the site · Supabase (free) keeps a backup of your data ·
UptimeRobot (free) pings the site every 5 minutes so it never sleeps · your BigRock domain points to Render.

1. **GitHub** (free): install GitHub Desktop → File → Add local repository → choose the `problemhunt`
   folder → "create a repository" → Publish repository (tick *Keep this code private*).
2. **Supabase** (free): supabase.com → New project (region Mumbai) → Project Settings → API →
   copy *Project URL* and the *service_role* / *secret* key. Keep the key private.
3. **Render** (free): render.com → sign in with GitHub → New → Blueprint → pick your repo →
   fill PH_ADMIN_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_KEY → Apply. Wait for "Live".
   Test: https://problemhunt-XXXX.onrender.com
4. **Domain**: Render → your service → Settings → Custom Domains → add `yourdomain.com` and
   `www.yourdomain.com`. Add exactly the records Render shows (A record for the root, CNAME for www)
   in BigRock → DNS Management (or in Cloudflare with the orange cloud OFF if you moved nameservers there).
   Click Verify; the HTTPS certificate is automatic.
5. **Keep awake**: uptimerobot.com (free) → New monitor → HTTP(s) →
   `https://yourdomain.com/api/health` → every 5 minutes.
6. Open your site → sign up with the admin email + a password → Account → turn on 2-step verification.

Updates: change files → GitHub Desktop → Commit → Push. Render redeploys automatically and the data
comes back from the Supabase backup (saved every 5 minutes and on every restart).

Limits: one free Render service uses ~744 of the 750 free hours per month (enough for 24/7);
if the monthly free bandwidth runs out the site pauses until next month; changes from the last
few minutes before a crash can be lost.
