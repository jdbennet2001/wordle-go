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
│       ├── publish-ghcr.yml
│       ├── mirror-to-ecr.yml
│       └── remove-ecr.yml
├── deploy/
│   └── images.yaml
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

## AWS ECR Docker Publish (PoC)

As a proof of concept, this repository also includes workflows for publishing the image to a private Amazon Elastic Container Registry (ECR) repository:

1. .github/workflows/mirror-to-ecr.yml
	Manifest-driven. Mirrors every service listed in deploy/images.yaml from GHCR to ECR, creating each ECR repository as needed.
2. .github/workflows/remove-ecr.yml
	Tears down an ECR repository, deleting all images in it. Requires re-typing the repository name as a confirmation input.

### The deployment manifest (deploy/images.yaml)

deploy/images.yaml is the single source of truth for the images that make up the deployment. It has three parts:

1. `registries` — where images live. `ghcr` is the source (owner namespace included); `ecr` is the target. Selecting one as the `${REGISTRY}` prefix is all a docker-compose consumer changes to switch registries.
2. `aws.region` — the region the ECR repositories live in.
3. `services` — a map of service name to its deployment. Each service declares a `repository` (image basename, shared across both registries), a `tag`, optional `aliases` (extra ECR tags), an optional `digest` (pin for a reproducible deployment), and an optional `source` (only when the image lives outside the ghcr prefix, e.g. a third-party image mirrored into ECR).

mirror-to-ecr reads this file, resolves each service's source (`<ghcr>/<repository>` unless `source` overrides it), copies it to `<ecr>/<repository>` with the same tag plus aliases, and writes a Service / ECR reference / Digest table to the run summary. Because the service key is also the docker-compose service name, this map is the bridge between CI and the compose file.

Both run on manual trigger only (workflow_dispatch). Each can also be invoked from another workflow (workflow_call), in which case the AWS access key secrets are passed in as inputs by the caller.

### mirror-to-ecr: how the copy works

For each service, the workflow logs in to both registries and runs:

```bash
docker buildx imagetools create \
  --tag <ecr>/<repository>:<tag> \
  --tag <ecr>/<repository>:<alias> \
  <ghcr>/<repository>:<tag>
```

This copies the full manifest list — both linux/amd64 and linux/arm64 — registry-to-registry without pulling image layers to the runner, so the ECR image is byte-identical to (and shares the digest of) the GHCR one. All aliases point at that same digest, so pulling `:latest` or `:wordle` gives the identical image.

The workflow takes a single input, `manifest` (default: `deploy/images.yaml`); everything else — region, registries, per-service tags and aliases — comes from the manifest.

### remove-ecr: teardown

Deletes the ECR repository with `aws ecr delete-repository --force` (removes contained images too). Safeguards:

1. The confirm input must exactly match the repository name, or the run aborts before touching AWS.
2. If the repository does not exist, the workflow reports that and exits successfully (idempotent).

### What gets published

The image is pushed to a private ECR repository in your AWS account:

- `<account-id>.dkr.ecr.<region>.amazonaws.com/<ECR_REPOSITORY>`

The registry host is resolved automatically at run time by `aws-actions/amazon-ecr-login`, so you never hard-code the account ID.

mirror-to-ecr creates each ECR repository on first run if it does not already exist (`describe-repositories || create-repository`, with scan-on-push enabled), so no manual repo provisioning is required.

### Authentication (access key secrets)

This PoC authenticates with a long-lived IAM access key stored as GitHub Actions secrets. Add these under Settings -> Secrets and variables -> Actions -> Secrets:

1. AWS_ACCESS_KEY_ID
2. AWS_SECRET_ACCESS_KEY

The IAM user/role behind the key needs permission to authenticate to ECR and push images, for example:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "EcrPushCreateAndRemove",
      "Effect": "Allow",
      "Action": [
        "ecr:DescribeRepositories",
        "ecr:DescribeImages",
        "ecr:CreateRepository",
        "ecr:DeleteRepository",
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    }
  ]
}
```

> Note: access keys are used here for PoC simplicity. For anything beyond a PoC, prefer GitHub OIDC federation with an assumed IAM role so no long-lived credentials are stored in the repository.

### Tags that are produced

Per service, mirror-to-ecr applies the manifest `tag` plus any `aliases` — for wordle-go that is `latest` and `wordle`, both pointing at the same digest. Change or add tags by editing the service entry in deploy/images.yaml.

### Manual publish steps

1. Add the AWS access key secrets (once).
2. Run Build and Publish GHCR Image first, so the source images exist in GHCR.
3. Confirm deploy/images.yaml lists the services and target registry you want.
4. Open GitHub -> Actions.
5. Select mirror-to-ecr, then Run workflow.
6. Wait for completion and review the Mirrored images table in the run summary.

### Manual teardown steps

1. Open GitHub -> Actions.
2. Select remove-ecr.
3. Click Run workflow, set aws-region / ecr-repository if they differ from the defaults, and type the repository name into the confirm field.
4. The run deletes the ECR repository and all images in it.

### Pulling the image

Authenticate Docker to your registry, then pull. Replace `<account-id>` and `<region>` with your values (both are printed by the workflow):

```bash
aws ecr get-login-password --region <region> \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

docker pull <account-id>.dkr.ecr.<region>.amazonaws.com/wordle-go:latest
```

Or use one of the SHA/branch/tag versions printed by the workflow.

### Granting external users read-only pull access

The ECR repository is private, so external users cannot pull anonymously. Instead, a select set of users are granted access by issuing them read-only IAM credentials scoped to this repository.

The model:

1. One IAM managed policy grants read-only pull access to this repository only.
2. One IAM group carries that policy.
3. Each external user gets an IAM user in the group, with an access key as their read-only credential.

Access is revoked per-user by deleting their access key (or the user), without touching anyone else.

#### 1. Create the read-only policy

Save as `ecr-wordle-readonly.json` (replace `<account-id>` and `<region>`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "EcrPullWordleGo",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:DescribeImages",
        "ecr:ListImages"
      ],
      "Resource": "arn:aws:ecr:<region>:<account-id>:repository/wordle-go"
    }
  ]
}
```

Notes:

- `ecr:GetAuthorizationToken` must be `Resource: "*"` — it is an account-level action and cannot be scoped to one repository.
- The pull actions are scoped to the `wordle-go` repository ARN only, so the credential cannot read any other repository in the account.

Create it:

```bash
aws iam create-policy \
  --policy-name ecr-wordle-readonly \
  --policy-document file://ecr-wordle-readonly.json
```

#### 2. Create the group and attach the policy

```bash
aws iam create-group --group-name wordle-go-readers

aws iam attach-group-policy \
  --group-name wordle-go-readers \
  --policy-arn arn:aws:iam::<account-id>:policy/ecr-wordle-readonly
```

#### 3. Onboard an external user

For each user to be granted access:

```bash
aws iam create-user --user-name wordle-reader-<name>
aws iam add-user-to-group --group-name wordle-go-readers --user-name wordle-reader-<name>
aws iam create-access-key --user-name wordle-reader-<name>
```

The `create-access-key` output contains the `AccessKeyId` and `SecretAccessKey`. Deliver these to the user through a secure channel (not email or chat) — the secret is shown only once.

#### 4. Instructions for the external user

Prerequisites: AWS CLI and Docker installed.

Configure the issued credentials (a named profile keeps them separate from any other AWS credentials):

```bash
aws configure --profile wordle-reader
# AWS Access Key ID:     <issued key id>
# AWS Secret Access Key: <issued secret>
# Default region name:   <region>
```

Authenticate Docker and pull:

```bash
aws ecr get-login-password --region <region> --profile wordle-reader \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

docker pull <account-id>.dkr.ecr.<region>.amazonaws.com/wordle-go:latest
```

The Docker login token expires after 12 hours; users re-run the `get-login-password` line to refresh it. The underlying access key does not expire.

#### 5. Revoking access

Remove a single user's access:

```bash
aws iam list-access-keys --user-name wordle-reader-<name>
aws iam delete-access-key --user-name wordle-reader-<name> --access-key-id <key-id>
aws iam remove-user-from-group --group-name wordle-go-readers --user-name wordle-reader-<name>
aws iam delete-user --user-name wordle-reader-<name>
```

#### Production considerations

This IAM-user model is deliberately simple for a PoC. For a production rollout, consider:

- Short-lived credentials via IAM Identity Center or federation instead of long-lived access keys
- A cross-account repository policy if consumers have their own AWS accounts (they then use their own credentials — nothing to issue or rotate)
- ECR pull-through or replication if consumers are in other regions
- CloudTrail monitoring of `GetAuthorizationToken` / `BatchGetImage` events for audit of who pulled what, when

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
