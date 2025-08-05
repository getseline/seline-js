# Seline Web

This is a JavaScript library of [Seline analytics](https://seline.com).

```
npm i @seline-analytics/web
```

Then initialize it in your code.

```
import * as seline from '@seline-analytics/web

seline.init();
```

## Methods

### init

Initializes Seline. No tracking happens before this method is called.

```
seline.init({
  // Token is *required* when tracking subdomains or multiple domains.
  token: 'PROJECT TOKEN';
  // By default, we track all page views automatically.
  // But if you want manual tracking with seline.page(), you can set autoPageView to false.
  autoPageView: false;
  // Skip tracking of provided pages, wildcard * is supported
  skipPatterns: ['/about', '/blog/*'];
  // Mask parts of pages that match provided patterns, wildcard * is supported
  maskPatterns: ['/customer/*/order/*'];
});
```

init() options:

- **token** - Token is *required* when tracking subdomains or multiple
  domains. You can find your project token in the project settings.

- **autoPageView** - Set to **true** by default. But if you want manual
  tracking with **seline.page()**, you can set **autoPageView**
   to **false**.

- **skipPatterns** - Specify an array of pages or patterns you don't want
  to be tracked. These can be exact paths, such as **/about**
  or **/how-it-works**, or patterns with a wildcard **\***, such as **
    /blog/\*
  ** or **/projects/\*/visitors/\***.

- **maskPatterns** - Specify an array of pages or patterns you want to mask.
  This works similarly to **skipPatterns**, but instead of skipping
  routes, it masks them and _tracks_ the masked value. Ideal if you want to mask
  routes with private IDs, like **/customer/\*/order/\***.

#### page

If you set **autoPageView** to **false**, you can manually track _current page_ views.

```
seline.page();
```

#### track

Track custom events using **seline.track()**. You can pass event name and custom properties.

```
seline.track('Order completed', {
  delivery: 'DHL',
  total: 99.99
});
```

#### enableAutoPageView

If you loaded the script with **autoPageView** set to **false** you can enable it with **seline.enableAutoPageView()**.

```
seline.enableAutoPageView();
```

#### setUser

Populates visitors with custom data and creates a Profile. Great for tracking your authorized users.

```
seline.setUser({
  userId: "unique-user-id", // userId is a required field
  plan: "enterprise",
  credits: 140,
});
```
