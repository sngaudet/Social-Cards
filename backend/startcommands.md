# icebreakers backend command reference

run these from repo root unless a command says `cd backend` first

## 1) one-time setup

install root deps (expo app deps):

```bash
npm install
```

install backend deps used by firebase functions:

```bash
cd backend
npm install
cd ..
```

## 2) auth + project selection

log firebase cli into your account:

```bash
npx firebase-tools@latest login --no-localhost
```

select the firebase project for this repo:

```bash
npx firebase-tools use social-cards-b8e6f
```

give local scripts (like seeding) firestore access:

```bash
gcloud auth application-default login
```

## 3) deploy commands

deploy backend cloud functions from `backend`:

```bash
npx firebase-tools deploy --only functions
```

deploy firestore security rules only:

```bash
npx firebase-tools deploy --only firestore:rules
```

deploy functions + rules together:

```bash
npx firebase-tools deploy --only functions,firestore:rules
```

## 4) local backend emulator

start local emulators for functions + firestore:

```bash
cd backend
npm run serve
cd ..
```

## 5) backend logs (production)

show recent nearby function logs:

```bash
npx firebase-tools functions:log --only location_getNearby --lines 100
```

show recent location pipeline logs:

```bash
npx firebase-tools functions:log --only location_upsertPing,location_getControlStatus,location_setSharing --lines 100
```

show push token registration logs:

```bash
npx firebase-tools functions:log --only location_registerPushToken --lines 100
```

## 6) make fake nearby users

create fake users + presence docs around your point for quick nearby testing:

```bash
cd backend
npm run seed:nearby-fakes -- --lat 43.072178704337965 --lng -87.88516313602382 --geohash dp9t015cxk --count 8 --spreadFt 35 --ttlMinutes 90
cd ..
```

custom seed template:

```bash
cd backend
npm run seed:nearby-fakes -- --lat <lat> --lng <lng> --count <num> --spreadFt <feet> --ttlMinutes <minutes> --prefix <prefix>
cd ..
```

options:

- `--geohash`: optional, auto-computed if missing
- `--count`: default `8`
- `--spreadFt`: default `0` (same point)
- `--ttlMinutes`: default `60`
- `--prefix`: default `fake` (`fake_01`, `fake_02`, ...)

important:

- `location_getNearby` uses your own live location as the center point
- if your phone is not near the seeded lat/lng, those fakes will not show
- if your location ping is stale or missing, nearby returns empty
