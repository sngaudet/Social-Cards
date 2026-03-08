# backend quick start

## 1. install backend deps

```bash
cd backend
npm install
cd ..
```

## how to start backend locally

run functions + firestore emulators:

```bash
cd backend
npm run serve
```

## how to run backend tests

in a second terminal:

```bash
cd backend
npm test
```

## 2. one-time firebase cli setup (for deploy)

login:

```bash
npx firebase-tools@latest login --no-localhost
```

set this repo to the project:

```bash
npx firebase-tools use social-cards-b8e6f
```

## 3. deploy backend changes

deploy functions only:

```bash
npx firebase-tools deploy --only functions
```

deploy functions + firestore rules:

```bash
npx firebase-tools deploy --only functions,firestore:rules
```

---
