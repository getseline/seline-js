# Seline Web

This is a NodeJS library of [Seline analytics](https://seline.so).

```
  npm install @seline-analytics/node
```

Then create a tracking instance using your project token.

```
import { Seline } from 'seline-node';

const seline = Seline({
  token: 'PROJECT_TOKEN', // Token can be found at Settings - General.
});
```

## Methods

#### track

Track custom events using **seline.track()**. You can pass event name and custom properties.

```
seline.track({
  userId: "unique-user-id", // userId is a required field
  name: "order: created",
  data: {
    delivery: 'DHL',
    total: 99.99,
  },
});
```

#### setUser

Populates visitors with custom data and creates a Profile. Great for tracking your authorized users.
```
  seline.setUser({
  userId: "unique-user-id", // userId is a required field
  fields: {
    email: "john@wayne.corp",
    plan: "enterprise",
    credits: 140,
    projects: ["Project A", "Project B"],
  },
});
```
