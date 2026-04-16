# Wordle Go

Wordle Go is a full-stack Wordle-style game built with:

- Go for the backend server
- Fiber as the HTTP framework
- Vanilla JavaScript + jQuery on the frontend
- Basic HTML and CSS for the UI

The app serves all web assets from the public directory and uses a local JSON word list for puzzle generation.

## Project Goals

This project was built to keep the stack simple and explicit:

- No frontend framework
- No frontend build step
- No API server required for gameplay logic
- One Go service to host static files
- Responsive UI for phones, tablets, and desktop browsers

The result is a lightweight app that is easy to run locally and easy to publish as a static site through GitHub Pages.

## Features

- Wordle-style gameplay with 6 guesses and 5-letter words
- Full keyboard support
	- Physical keyboard input
	- On-screen keyboard input
- Duplicate-letter-aware guess evaluation logic
- Share button that copies a Wordle-style emoji result grid
- Random word selection on each app load
- New Puzzle button for instant random restart
- Cache-busting query keys for CSS and JS on every page load
- Mobile-aware viewport and touch tuning for better iPhone behavior
- Responsive layout for iPhone, iPad, and desktop form factors

## Repository Structure

```text
.
├── .github/
│   └── workflows/
│       └── deploy-pages.yml
├── .vscode/
│   └── launch.json
├── public/
│   ├── app.js
│   ├── index.html
│   ├── style.css
│   └── words.json
├── go.mod
├── go.sum
├── main.go
└── Readme.md
```

## How It Works

### Backend

The backend is intentionally thin and focused on static hosting:

- Fiber serves all files from ./public
- A wildcard route returns public/index.html for unmatched paths
- Port defaults to 3000 and can be overridden with PORT

This means the game can run as a traditional local web server without a separate frontend dev server.

### Frontend

The frontend is a pure browser app:

- HTML defines the layout shell (header, status, board, keyboard)
- CSS handles styling, responsive behavior, and touch ergonomics
- jQuery + vanilla JavaScript implement all gameplay logic

When loaded:

1. The app loads words.json
2. A random answer is selected
3. The board and keyboard are initialized
4. User input is accepted through keyboard and tap events
5. Guess results are animated and scored

## Running Locally

### Prerequisites

- Go 1.22+ installed

### Install dependencies

```bash
go mod tidy
```

### Run the server

```bash
go run .
```

Then open:

- http://localhost:3000

### Optional: use a different port

```bash
PORT=8080 go run .
```

## Debugging in VS Code

A launch configuration is included at .vscode/launch.json.

Use the Run and Debug panel and choose:

- Run Wordle Go (Fiber)

This compiles and launches the Go server from the workspace root.

## Gameplay Details

### Rules

- Guess a 5-letter word
- You get up to 6 attempts
- Tile colors after each guess:
	- Green: correct letter, correct position
	- Yellow: letter exists but in a different position
	- Gray: letter does not exist in the answer

### Word Source

Words are loaded from:

- public/words.json

Only valid string entries with length 5 are accepted into the playable list.

### Random Puzzle Selection

A random word is picked every time the app initializes. Pressing New Puzzle also selects a fresh random word.

## Sharing Results

After winning or losing, the Share button is enabled.

Clicking Share copies a text block like this to your clipboard:

```text
Wordle Go 20559 4/6

⬛🟨⬛⬛⬛
🟨🟩⬛⬛🟨
🟩🟩🟨⬛⬛
🟩🟩🟩🟩🟩
```

Clipboard behavior:

- Uses navigator.clipboard when available
- Falls back to a temporary textarea copy technique otherwise

## Caching Behavior

To reduce stale frontend logic and style issues, index.html appends a timestamp cache-busting query to:

- style.css
- app.js

This forces the browser to fetch fresh copies on each page load.

## Mobile and Responsive Behavior

The UI is designed for multiple form factors:

- iPhones (small viewport adjustments)
- iPads (tablet spacing and controls)
- Desktop (larger layout and key sizes)

Notable mobile-specific choices include:

- Safe-area padding support
- touch-action tuning on buttons/keys
- viewport settings to avoid unwanted zoom behavior during play

## GitHub Pages Deployment

A manual workflow exists at:

- .github/workflows/deploy-pages.yml

It is triggered via workflow_dispatch and deploys the static public folder to GitHub Pages.

### One-time repository setup

In your GitHub repository settings:

1. Go to Settings -> Pages
2. Set Source to GitHub Actions
3. Save

### Deploy manually

1. Open the Actions tab
2. Select Deploy to GitHub Pages
3. Click Run workflow

After deploy, GitHub provides the published page URL from the deploy job output/environment URL.

## Development Notes

- Keep all browser assets inside public
- Keep gameplay logic centralized in public/app.js
- Keep main.go focused on static hosting, not game state
- Prefer small, readable JavaScript functions over large monolithic blocks

## Troubleshooting

### App loads but game does not start

- Check browser console for errors
- Ensure public/words.json exists and is valid JSON
- Confirm words are lowercase 5-letter strings

### Server fails to start

- Confirm Go is installed
- Run go mod tidy to restore dependencies
- Ensure the selected port is not in use

### Styles or logic appear stale

- Hard refresh once
- Confirm cache-busting script is present in public/index.html

## Future Enhancements

Potential improvements you can add later:

- Persist in-progress game state with localStorage
- Add statistics (streaks, win rate, guess distribution)
- Add an optional hard mode
- Add animations and accessibility refinements
- Add automated tests for evaluateGuess and input handling

## License

Add your preferred license here (for example, MIT) if you plan to publish or share broadly.
