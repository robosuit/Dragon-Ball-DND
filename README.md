# Dragon Ball DnD Sheet (Static MVP)

This project is a plain HTML/CSS/JS character sheet with a D&D Beyond style layout, built for Dragon Ball themed DnD play.

## Player Launch Links

- Live Sheet: `https://robosuit.github.io/Dragon-Ball-DND/`
- Start Page (best for non-technical players): `https://robosuit.github.io/Dragon-Ball-DND/START_HERE.html`
- Top-level launcher file in repo: `OPEN_CHARACTER_SHEET.html`

## Features

- Sidebar + tabbed sheet sections
- Always-visible combat/resource cards
- Power level + transformation calculations
- Ki and HP tracking with quick actions
- Technique cards with roll and spend Ki buttons
- Save to Device / Load from Device JSON character files
- Data-driven races, transformations, and techniques
- DBU/DragonBallRedux baseline data mapped into `data/*.json`

## File Structure

- `index.html` - App layout
- `css/` - Theme, layout, and component styles
- `js/state.js` - Character state + local storage
- `js/calculations.js` - Derived stats and dice helpers
- `js/ui.js` - Rendering and user actions
- `data/*.json` - Editable game content

## Run Locally

Use a local web server (recommended) so JSON files load correctly.

PowerShell:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages Deploy

1. Push this repository to GitHub.
2. In repo settings, enable Pages and select branch `main` and folder `/ (root)`.
3. Share the generated Pages URL with players.
4. Players open the link, build a character, then click `Save to Device` to store a local JSON copy.

## Roll20 Porting Note

Keep IDs and key field names stable (`resources.currentKi`, `progression.basePowerLevel`, etc.).  
When porting to Roll20 sheet workers, reuse formulas from `js/calculations.js`.

## Data Sources Used

- DragonBallRedux V2 sheet structure and baseline values:
  - races + subraces
  - basic attack profiles (Ki costs and baseline dice)
- DBU sourcebook transformation names and progression labels for form metadata.

## Quick Access Files

- `START_HERE.html` - simple player-facing launch page
- `OPEN_CHARACTER_SHEET.html` - top-level launcher that redirects to `START_HERE.html`
- `WEBSITE_LINK_TEMPLATE.txt` - template for your final public GitHub Pages URL
