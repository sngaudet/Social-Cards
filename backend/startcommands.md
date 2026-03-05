# backend quick start

## 1. install backend deps

```bash
cd backend
npm install
cd ..
```

## 2. start backend locally

run functions + firestore emulators:

```bash
cd backend
npm run serve
```

## 3. run backend tests

in a second terminal:

```bash
cd backend
npm test
```

## 4. one-time firebase cli setup (for deploy)

login:

```bash
npx firebase-tools@latest login --no-localhost
```

set this repo to the project:

```bash
npx firebase-tools use social-cards-b8e6f
```

## 5. deploy backend changes

deploy functions only:

```bash
npx firebase-tools deploy --only functions
```

deploy functions + firestore rules:

```bash
npx firebase-tools deploy --only functions,firestore:rules
```

---
