# Demo Mode: Hints and Abuse Prevention

This project includes a lightweight demo mode to showcase features safely.

## What it does
- Shows a credentials hint on the login page (optional)
- Seeds known test accounts for quick access (admin/member)
- Adds configurable rate limiting to the API
- Optionally caps registrations or fully disables registration in demo

## Enable Demo Mode
### API (.env or platform variables)
```
DEMO_MODE=true
DEMO_DISABLE_REGISTER=false
DEMO_MAX_USERS=120
# API rate limit (defaults shown)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
# Optional overrides for seed accounts
DEMO_ADMIN_EMAIL=admin@club.dev
DEMO_ADMIN_PASSWORD=admin123
DEMO_COACH_EMAIL=coach@club.dev
DEMO_COACH_PASSWORD=coach123
DEMO_MEMBER_EMAIL=member@club.dev
DEMO_MEMBER_PASSWORD=member123
```

### Web (.env.local or platform variables)
```
NEXT_PUBLIC_SHOW_DEMO_HINTS=true
```

## Test Accounts
- Admin: `admin@club.dev` / `admin123`
- Coach (admin role): `coach@club.dev` / `coach123`
- Member: `member@club.dev` / `member123`
- Other seeded members: `firstname.lastname[number]@club.dev` / `member123`

## Notes
- Rate limiting is configurable via env (`RATE_LIMIT_*`). The server trusts proxies so IPs are captured correctly on platforms like Railway.
- In demo mode, the register route can be disabled or capped by total user count.
- The login page shows a banner only if `NEXT_PUBLIC_SHOW_DEMO_HINTS=true`.
- Reseed DB if needed using the seed script to reset demo data.
