# Harness Engineering — Project Dashboard

A small, dependency-free dashboard for tracking harness engineering projects.

- **In progress** — cards at the top with two bars: **Build progress** (green, percentage of waves done) and **Waves complete** (blue pips, one per wave). `+` / `−` advance or roll back a wave. Owner and Operator are shown under the project name.
- **Other projects** — a table below with Owner, Operator, Specification Docs and Documents columns, an inline stage dropdown, and a **Start** button to promote a project into the in-progress section. Documents is a link set on the edit screen; where one is set, in-progress cards get a **Documents** button too.
- **To do items** — name, description, assigned to, and state (not started / in progress / complete). State can be changed inline from the table; **+ Add to do item** and **Edit** open a dialog, which also holds Delete.
- **Specification documents** — every project tracks five documents: **R** Research, **S** SME Specification, **F** Functional Specification, **T** Technical Specification, **B** Build Plan. Each is *not started* (grey), *in progress* (orange) or *complete* (green), set on the edit screen and shown as five lettered circles on the card and in the table row. Hover a circle for its name and state.
- **Notes** — dashboard-level notes below Links, each with a title and a free-text body that keeps its line breaks. **+ Add note** / **Edit** open a dialog holding Delete. (Separate from the per-project Notes field on the project edit screen.)
- **Reordering** — rows in **Other projects** and **To do items** can be dragged by the `⠿` handle on the left. The handle is also focusable: tab to it and use the up/down arrow keys. The new order saves immediately and is the order stored in `data.json`.
- **Links** — a list of labelled links with an optional description, each with **Edit** and **Remove**. Only `http`/`https` addresses are accepted (a bare `example.com` gets `https://` added); links open in a new tab.
- **Editing projects** — **+ Add project** or **Edit** opens a dialog for name, client, owner, operator, documents link, status, stage, waves and notes. Delete lives in the same dialog. (Client is still stored and editable, but no longer shown as a table column.)
- **Storage** — locally, everything is persisted to `data.json` in this folder; on Netlify, to Netlify Blobs. Every change saves immediately.

## Run locally

```bash
node server.js
```

Then open <http://localhost:7333>. Port 7333 is the default (picked to stay clear of the usual 3000/8080 crowd); override it with `PORT=8080 node server.js`, or `$env:PORT=8080; node server.js` in PowerShell.

The local server needs no dependencies — only Node's built-in modules. `npm install` is needed solely for deploying (the Netlify function's Blobs client).

## Deploy to Netlify

Netlify has no long-running process and no writable disk, so `server.js` is not what runs there. `netlify/functions/data.js` serves the same `/api/data` endpoint and stores the document in [Netlify Blobs](https://docs.netlify.com/blobs/overview/). The front-end is identical either way, and both entry points share `lib/model.js`, so validation cannot drift between them.

Best: connect this folder as a Git repo in Netlify — it runs `npm install` and bundles the function for you. `netlify.toml` already sets the publish directory (`public`) and the functions directory, so there is nothing to configure in the UI.

Or from the command line:

```bash
npx netlify deploy --prod
```

Dragging the folder onto Netlify's dashboard also works, but nothing installs dependencies for you in that flow, so `node_modules/` has to be in the folder you drop.

**First deploy seeds from `data.json`** — the file is bundled with the function and copied into Blobs on the first request. After that the two are independent: the deployed site writes only to Blobs, and editing `data.json` locally no longer affects it. To reset the deployed data to the file's contents, delete the `harness-dashboard` blob store in the Netlify UI.

The site is public once deployed, and anyone who can open it can edit it. Put Netlify's password protection or Identity in front of it if that matters.

## Files

| Path | Purpose |
| --- | --- |
| `server.js` | Local server: static files + `GET`/`PUT /api/data`, saving to `data.json` |
| `netlify/functions/data.js` | The same API on Netlify, saving to Netlify Blobs |
| `lib/model.js` | Shared reading and validation rules used by both |
| `netlify.toml` | Publish directory, functions directory, `/api/data` fallback route |
| `data.json` | The local saved data, and the seed for a fresh deploy |
| `public/index.html` | Page markup and the dialogs |
| `public/app.js` | Rendering, editing, save calls |
| `public/styles.css` | Styling (light and dark) |

## Data shape

```json
{
  "stages": ["Not started", "Discovery", "Design", "Build", "Test", "Deploy", "Live"],
  "projects": [
    {
      "id": "p_abc123",
      "name": "Harness Core Rollout",
      "client": "Example Council",
      "owner": "Jo Smith",
      "operator": "Sam Patel",
      "documents": "https://example.com/sites/harness-docs",
      "docs": {
        "research": "complete",
        "sme": "complete",
        "functional": "in-progress",
        "technical": "not-started",
        "buildPlan": "not-started"
      },
      "status": "in-progress",
      "stage": "Build",
      "wavesTotal": 6,
      "wavesComplete": 2,
      "notes": "",
      "updatedAt": "2026-09-16T09:00:00.000Z"
    }
  ],
  "todos": [
    {
      "id": "t_abc123",
      "name": "Move repo to the org account",
      "description": "Migrate branches and set up CI.",
      "assignedTo": "Jo Smith",
      "state": "in-progress",
      "updatedAt": "2026-09-16T09:00:00.000Z"
    }
  ],
  "links": [
    {
      "id": "l_abc123",
      "label": "Delivery board",
      "url": "https://example.com/board",
      "description": "Sprint board",
      "updatedAt": "2026-09-16T09:00:00.000Z"
    }
  ],
  "notes": [
    {
      "id": "n_abc123",
      "title": "Wave 3 decisions",
      "body": "Agreed to split the migration across two waves.",
      "updatedAt": "2026-09-16T09:00:00.000Z"
    }
  ]
}
```

`status` is either `in-progress` (renders as a card at the top) or `other` (renders in the table). A to do item's `state` is one of `not-started`, `in-progress`, `complete`.

To change the stage list, edit the `stages` array in `data.json` while the server is stopped, then restart. Writes are atomic (temp file + rename) and serialised, so a save cannot leave `data.json` half-written.

## Notes / limitations

- No authentication — add Netlify password protection or Identity before sharing a deployed copy.
- Saves replace the whole document; if two people have the page open at once, the last save wins. This matters much more once the dashboard is hosted than it did on one machine.
