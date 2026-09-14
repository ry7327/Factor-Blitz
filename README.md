# Factor Blitz

A free-to-host multiplication practice + ranked competition game.
Plain HTML/CSS/JS &mdash; no build step required.

## Run it locally

1. Unzip this folder somewhere on your computer.
2. Open the folder in VS Code.
3. Install the **Live Server** extension (search "Live Server" by Ritwick Dey
   in the Extensions panel).
4. Right-click `index.html` -> "Open with Live Server".

The site will open in your browser and auto-refresh whenever you save a file.

Note: the leaderboards won't load data until you connect Supabase (see below)
&mdash; everything else (Practice mode, Ranked gameplay, both game types,
light/dark mode) works fully offline.

## Connect the leaderboard (Supabase)

1. Create a free account at supabase.com and a new project.
2. In your project, open the SQL Editor and run everything in
   `supabase-setup.sql` (in this folder).
3. Go to Project Settings -> API, and copy your **Project URL** and
   **anon public key**.
4. Paste them into `js/supabaseConfig.js`.

## Deploy for free

1. Create a free GitHub account, create a new repository, and upload this
   whole folder (drag-and-drop through the GitHub website works fine).
2. Create a free Netlify account, choose "Import from GitHub", pick the
   repository. Leave build settings blank (there's no build step) and deploy.
3. Netlify gives you a public URL immediately, and re-deploys automatically
   whenever you update the GitHub repo.
