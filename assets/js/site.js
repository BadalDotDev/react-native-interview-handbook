/*
 * Site configuration — the single source of truth for navigation.
 * Sidebar, home-page cards, previous/next links and search all read from here.
 * To add a page: create the HTML file (copy an existing page) and add an entry below.
 */
window.SITE = {
  title: 'React Native Interview Handbook',
  shortTitle: 'RN Interview Handbook',
  tagline: 'Beginner to Senior — questions, answers and production implementation guides.',
  // Bump when content changes so cached search indexes refresh.
  version: '2026.09.1',
  // Optional: set to your GitHub repository URL to show a GitHub link in the header.
  repoUrl: '',

  nav: [
    {
      section: 'Start',
      items: [
        { title: 'Home', path: 'index.html', icon: 'home' }
      ]
    },
    {
      section: 'Interview Q&A',
      id: 'qa',
      items: [
        { title: 'Beginner', path: 'questions/beginner.html', level: 'Beginner',
          desc: 'Core components, styling & Flexbox, props/state, lists, navigation basics, tooling.' },
        { title: 'Intermediate', path: 'questions/intermediate.html', level: 'Intermediate',
          desc: 'Hooks in depth, state management, navigation patterns, animations, forms, networking, TypeScript.' },
        { title: 'Advanced', path: 'questions/advanced.html', level: 'Advanced',
          desc: 'JSI, Fabric, TurboModules, threading, Hermes, native modules, Metro, performance internals.' },
        { title: 'Senior & System Design', path: 'questions/senior.html', level: 'Senior',
          desc: 'Mobile system design, architecture decisions, release engineering, leadership and STAR stories.' },
        { title: 'Live Coding Challenges', path: 'questions/coding-challenges.html', level: 'Coding',
          desc: 'Custom hooks, UI components, data logic, debug-this-code and JS fundamentals with solutions.' }
      ]
    },
    {
      section: 'Platform Features',
      id: 'features',
      items: [
        { title: 'Push Notifications', path: 'guides/push-notifications.html',
          desc: 'APNs & FCM, tokens, foreground/background/killed handling, rich pushes, backend sending.' },
        { title: 'Deep Linking & Universal Links', path: 'guides/deep-linking.html',
          desc: 'URI schemes, Universal Links, App Links, AASA & assetlinks, deferred links, auth-gated routing.' },
        { title: 'Permissions', path: 'guides/permissions.html',
          desc: 'iOS & Android permission models, state machine, primers, Settings round-trips, store policy.' },
        { title: 'Location & Maps', path: 'guides/location.html',
          desc: 'Foreground & background location, geofencing, maps, live tracking architecture, battery.' },
        { title: 'Camera, Media & Uploads', path: 'guides/camera.html',
          desc: 'VisionCamera, pickers, QR scanning, compression, presigned & resumable uploads.' },
        { title: 'App Icon & Splash Screen', path: 'guides/app-icon-splash.html',
          desc: 'Icon specs, adaptive & themed icons, LaunchScreen, Android 12 SplashScreen API, bootsplash.' },
        { title: 'Payments & In-App Purchases', path: 'guides/payments.html',
          desc: 'Stripe/Razorpay, Apple Pay & Google Pay, StoreKit & Play Billing, receipts, subscriptions.' },
        { title: 'Authentication & Sessions', path: 'guides/authentication.html',
          desc: 'OAuth + PKCE, social login, token refresh queues, biometrics, secure session restore.' },
        { title: 'Offline Storage & Sync', path: 'guides/offline-storage.html',
          desc: 'MMKV, SQLite, WatermelonDB, outbox pattern, conflict resolution, cache persistence.' },
        { title: 'Background Tasks', path: 'guides/background-tasks.html',
          desc: 'BGTaskScheduler, WorkManager, headless JS, foreground services, silent pushes.' }
      ]
    },
    {
      section: 'Ship & Operate',
      id: 'ship',
      items: [
        { title: 'Deployment, Signing & CI/CD', path: 'guides/deployment.html',
          desc: 'Certificates, keystores, store submission, TestFlight, Play tracks, Fastlane, GitHub Actions, EAS.' },
        { title: 'OTA Updates', path: 'guides/ota-updates.html',
          desc: 'EAS Update, CodePush alternatives, runtime versions, rollouts, rollbacks, forced updates.' },
        { title: 'Testing Strategy', path: 'guides/testing.html',
          desc: 'Jest, Testing Library, MSW, Detox, Maestro, CI pipelines and release QA.' },
        { title: 'Monitoring & Analytics', path: 'guides/monitoring.html',
          desc: 'Sentry, Crashlytics, symbolication, release health, performance monitoring, analytics.' }
      ]
    },
    {
      section: 'Architecture & Quality',
      id: 'arch',
      items: [
        { title: 'The New Architecture', path: 'guides/new-architecture.html',
          desc: 'JSI, Fabric, TurboModules, Codegen, bridgeless — plus writing modules and migrating.' },
        { title: 'Performance', path: 'guides/performance.html',
          desc: 'Measuring, startup, rendering, lists, images, memory, animations and app size.' },
        { title: 'Security', path: 'guides/security.html',
          desc: 'Threat model, secure storage, pinning, attestation, data protection, supply chain.' }
      ]
    }
  ]
};
