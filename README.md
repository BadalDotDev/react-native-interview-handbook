# React Native Interview Handbook

A static study site for **Senior React Native interviews**. It has two parts:

- **Interview Q&A:** beginner, intermediate, advanced and senior/system-design questions, plus live-coding challenges. Every answer starts with a short version you can say out loud, then goes into depth, code, trade-offs and what the interviewer is listening for.
- **Implementation guides:** step-by-step production references with diagrams, covering push notifications, deep and universal links, permissions, location, camera and uploads, app icon and splash screen, payments and in-app purchases, authentication, offline storage, background tasks, deployment and CI/CD, OTA updates, testing, monitoring, the New Architecture, performance and security.

It is plain HTML, CSS and JavaScript. There is **no build step**, so GitHub Pages can serve the folder as it is.

## Features

- Collapsible, auto-numbered Q&A cards with **progress tracking** ("Mark as reviewed", saved in the browser)
- **Practice tools**: Expand/Collapse all, Random question, Hide reviewed
- **Search** across every page, question and section (press `/` or `⌘K`)
- **Mermaid diagrams** (sequence, flow and state) that re-theme for light/dark mode, with an Expand view
- Syntax-highlighted code with copy buttons, callouts, tables, and checklists you can tick off (saved per page)
- Light/dark theme, responsive layout, "On this page" outline, and print / save as PDF with every answer expanded

## Project structure

```
.
├── index.html                 # Home page (HTML; card grids are generated from site.js)
├── 404.html                   # GitHub Pages not-found page
├── .nojekyll                  # Tells GitHub Pages to serve files as-is (no Jekyll)
├── questions/                 # Interview Q&A pages
│   ├── beginner.html
│   ├── intermediate.html
│   ├── advanced.html
│   ├── senior.html
│   └── coding-challenges.html
├── guides/                    # Implementation guides
│   ├── push-notifications.html, deep-linking.html, permissions.html, location.html,
│   ├── camera.html, app-icon-splash.html, payments.html, authentication.html,
│   ├── offline-storage.html, background-tasks.html, deployment.html, ota-updates.html,
│   └── testing.html, monitoring.html, new-architecture.html, performance.html, security.html
└── assets/
    ├── css/style.css          # All styles (light/dark tokens at the top)
    ├── js/site.js             # Site config: title, navigation, page descriptions
    ├── js/app.js              # Renderer: layout, Markdown, Q&A cards, diagrams, search, theme
    └── favicon.svg
```

## Preview locally

Opening `index.html` directly works, but search only covers the current page when the file is opened from disk. Run a tiny local server for the full experience:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Host on GitHub Pages

1. Create a new repository on GitHub, e.g. `react-native-interview-handbook`.
2. Push the contents of this folder to the repository's default branch (`main`).
3. On GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose `main` and `/ (root)`, then **Save**.
5. After a minute the site is live at `https://<your-username>.github.io/<repository-name>/`.

> To serve it at `https://<your-username>.github.io/` instead, name the repository `<your-username>.github.io`.

Optional: set `repoUrl` in `assets/js/site.js` to your repository URL to show a GitHub icon in the header.

## Editing content

Every content page keeps its text as **Markdown** inside the page itself:

```html
<script type="text/markdown" id="page-content">
# Page title
Lead paragraph…
</script>
```

Edit the Markdown and refresh the page. The conventions are:

| Markdown | Renders as |
|---|---|
| `## Heading` | Section (appears in the "On this page" outline) |
| `### Question?` on a `questions/*` page | A numbered, collapsible Q&A card |
| `### Question?` under `## Interview questions` in a guide | A Q&A card |
| ```` ```tsx title="App.tsx" ```` | Code block with a file-name header |
| ```` ```mermaid ```` followed by `*Figure: caption*` | Diagram with a caption |
| `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`, `[!INTERVIEW]` | Callouts |
| `- [ ] item` | A checklist item that stays ticked (saved in the browser) |

Don't write the literal text `</script>` inside the Markdown, because it would end the block early.

### Adding a page

1. Copy an existing page (e.g. `guides/testing.html`) to a new file in the same folder.
2. Update `<title>`, the `description` meta tag and `data-page="guides/<new-file>.html"` on `<body>`.
3. Replace the Markdown.
4. Add an entry to `SITE.nav` in `assets/js/site.js`. The sidebar, home-page cards, previous/next links and search pick it up automatically.
5. Bump `SITE.version` so browsers rebuild their cached search index.

## Third-party libraries (loaded from CDNs)

- [marked](https://github.com/markedjs/marked) 12: Markdown rendering
- [highlight.js](https://highlightjs.org/) 11: syntax highlighting
- [Mermaid](https://mermaid.js.org/) 11: diagrams (loaded only when a diagram scrolls into view)
- Google Fonts: Inter and JetBrains Mono

## A note on accuracy

The content reflects the React Native ecosystem as of late 2026: New Architecture only (RN 0.82+), Expo SDK 54+, and CodePush and Firebase Dynamic Links retired. App Store and Google Play requirements change every year, so check store-policy details (target SDK levels, billing rules, privacy requirements) against the official documentation before you rely on them.
