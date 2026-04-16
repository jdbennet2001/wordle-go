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
│       ├── deploy-pages.yml
│       └── publish-ghcr.yml
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

## GHCR Docker Publish

This repository also includes a workflow to build and push a Docker image to GitHub Container Registry (GHCR):

- .github/workflows/publish-ghcr.yml

It runs on:

- Manual trigger only (workflow_dispatch)

### What gets published

The image is pushed to:

- ghcr.io/<owner>/<repo>

For this repository, that resolves to:

- ghcr.io/jdbennet2001/wordle-go

### Environment variables used in the workflow

The workflow defines these top-level env values:

1. REGISTRY
	Value: ghcr.io
	Purpose: tells docker/login-action and docker/metadata-action which registry host to use.
2. IMAGE_NAME
	Value: ${{ github.repository }}
	Purpose: uses owner/repo from the current repository automatically, so image names stay consistent across forks and clones.

The workflow also uses these GitHub-provided context values and secrets:

1. github.actor
	Purpose: username used when logging into GHCR.
2. secrets.GITHUB_TOKEN
	Purpose: short-lived token used to authenticate pushes to GHCR from Actions.
3. github.repository
	Purpose: owner/repo value used in image naming and output messages.
4. github.repository_owner
	Purpose: used in the package-page output URL.

### Tags that are produced

The workflow uses docker/metadata-action to generate tags:

1. Branch tag (for branch builds)
2. Git tag tag (for version tags)
3. Commit SHA tag
4. latest (only on the default branch)

### Repository configuration required

Before the workflow can publish successfully, configure the repository as follows:

1. Actions permissions
	Go to Settings -> Actions -> General.
	Under Workflow permissions, allow read and write permissions for GITHUB_TOKEN.
2. Package permissions
	Ensure the workflow has packages: write permission (already set in publish-ghcr.yml).
3. GHCR package visibility
	The first push may create a private package by default.
	Open the package in GitHub Packages and set visibility to Public if you want anonymous pulls.
4. Branch expectations
	This workflow does not run automatically on branch pushes.
	Run it explicitly from the Actions tab when you want to publish.

### Manual publish steps

1. Open GitHub -> Actions.
2. Select Build and Publish GHCR Image.
3. Click Run workflow.
4. Wait for completion and review the Print image references step output.

### Pulling the image

After publish, pull with:

```bash
docker pull ghcr.io/jdbennet2001/wordle-go:latest
```

Or use one of the SHA/branch/tag versions printed by the workflow.

## Local Deployment - Docker (Basic Test)

For a quick test, run the image directly with Docker on port 2000.

### Pull and run in one step

```bash
docker run -p 2000:3000 --rm ghcr.io/jdbennet2001/wordle-go:latest
```

This command:

- `-p 2000:3000` — maps container port 3000 to your localhost port 2000
- `--rm` — automatically removes the container when it exits
- `ghcr.io/jdbennet2001/wordle-go:latest` — pulls the image if not present and runs it

### Access the app

Open your browser:

```
http://localhost:2000
```

### View logs

Logs print to stdout, so you see them in your terminal. The app starts with:

```
Wordle server listening on http://localhost:3000
```

### Stop the container

Press `Ctrl+C` in the terminal where the container is running.

## Local Deployment - Docker Desktop (Kubernetes)

You can deploy the GHCR image to Kubernetes running on Docker Desktop. This section covers pulling the image and exposing the app on port 2500.

### Prerequisites

1. Docker Desktop installed with Kubernetes enabled
   - Open Docker Desktop Preferences -> Kubernetes
   - Check "Enable Kubernetes"
   - Click "Apply & Restart"
   - Wait for Kubernetes to start (green indicator shows in Docker menu)

2. kubectl installed and configured
   - Docker Desktop includes kubectl automatically
   - Verify with: kubectl version --client

### Pull the image

Pull the latest image from GHCR:

```bash
docker pull ghcr.io/jdbennet2001/wordle-go:latest
```

### Create a Kubernetes Deployment

Create a file named `wordle-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wordle-go
  labels:
    app: wordle-go
spec:
  replicas: 1
  selector:
    matchLabels:
      app: wordle-go
  template:
    metadata:
      labels:
        app: wordle-go
    spec:
      containers:
      - name: wordle-go
        image: ghcr.io/jdbennet2001/wordle-go:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: PORT
          value: "3000"
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "128Mi"
            cpu: "500m"
```

### Create a Kubernetes Service

Create a file named `wordle-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: wordle-go-service
  labels:
    app: wordle-go
spec:
  type: LoadBalancer
  ports:
  - port: 2500
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: wordle-go
```

### Deploy to Kubernetes

Apply both manifests:

```bash
kubectl apply -f wordle-deployment.yaml
kubectl apply -f wordle-service.yaml
```

### Verify deployment

Check pod status:

```bash
kubectl get pods -l app=wordle-go
```

Check service status:

```bash
kubectl get svc wordle-go-service
```

Watch logs:

```bash
kubectl logs -l app=wordle-go -f
```

### Access the app

Once the service shows an external IP (usually `localhost` on Docker Desktop), open your browser:

```
http://localhost:2500
```

The LoadBalancer service type automatically exposes the container port 3000 to your host on port 2500.

### Cleanup

Delete the deployment and service:

```bash
kubectl delete -f wordle-deployment.yaml
kubectl delete -f wordle-service.yaml
```

Or delete by name:

```bash
kubectl delete deployment wordle-go
kubectl delete service wordle-go-service
```

### Optional customizations

Common changes you may want:

1. Use a different image naming scheme
	Override IMAGE_NAME with a fixed value such as jdbennet2001/wordle-go-web.

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
