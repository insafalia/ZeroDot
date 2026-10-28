# ZeroDot

Solo salon appointment book for Android, iOS, and web. Bookings, clients, and menu prices are stored in Supabase.

## Run

```bash
npm install
npm run web
```

`npm start` opens the Expo dev tools. Use Expo Go on a phone for Android, or a simulator for iOS.

## Studio login

Sign in as `studio@zerodot.app`. The password lives in `.env.server` as `APP_OWNER_PASSWORD`.

## Data

Service prices and durations in Settings fill the next booking. Each visit keeps its own price, and you can change that price later without rewriting the menu. A mobile number is required and unique. A name is optional: the book shows the name when it exists, otherwise the number.
