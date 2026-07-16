# Manual Deployment Test Plan

End-to-end validation that the same image runs locally whether it is pulled from
**GHCR** (the source registry) or **ECR** (the mirrored registry). The registry
is switched by nothing more than the compose env file, proving the
build-once / publish-anywhere design.

## What this validates

1. CI builds the multi-arch image and publishes it to GHCR.
2. The default compose config deploys it locally from GHCR and the UI works.
3. The mirror workflow copies the image GHCR → ECR (creating the repo if needed).
4. After wiping the local deployment **and the local image cache**, the same
   compose config redeploys from ECR and the UI works identically.

If step 7 renders the same working UI as step 3 — having pulled from a different
registry — the mechanism is proven.

## Concrete values used below

| Thing | Value |
| --- | --- |
| GHCR image | `ghcr.io/jdbennet2001/wordle-go` |
| ECR image | `612054226364.dkr.ecr.eu-west-1.amazonaws.com/wordle-go` |
| AWS account / region | `612054226364` / `eu-west-1` |
| Local URL | http://localhost:2000 |
| Compose project | `wordle` (containers named `wordle-*`) |

All commands run from the `deploy/` directory unless stated otherwise.

## Install the tooling (one-time, macOS)

Install the CLIs the plan uses via Homebrew:

```bash
brew install awscli yq   # awscli = AWS CLI v2; yq = mikefarah's Go yq (used by the workflows)
```

If a freshly installed command still reports `command not found` in your current
shell, zsh has cached the old lookup — clear it (or open a new terminal):

```bash
hash -r
```

`docker` and `docker compose` ship with Docker Desktop. `gh` (GitHub CLI) is
optional, used only for the GHCR login shortcut below.

Configure AWS credentials for account `612054226364` (reuse the same IAM access
key you stored in the GitHub secrets), with the region matching `.env.ecr`:

```bash
aws configure
# AWS Access Key ID     [None]: AKIA…         <- same key as the GitHub secret
# AWS Secret Access Key [None]: …
# Default region name   [None]: eu-west-1
# Default output format [None]: json

aws sts get-caller-identity   # should report account 612054226364
```

> The AWS CLI may suggest `aws login` in an error — ignore it; `aws configure`
> is the correct command for access keys.

## Prerequisites

- **Docker Desktop running** (`docker version` succeeds).
- **AWS CLI installed and configured** for account `612054226364` (see above) —
  used for the local ECR docker login and for verification.
- **GitHub repo secrets set** for the mirror workflow: `AWS_ACCESS_KEY_ID` and
  `AWS_SECRET_ACCESS_KEY` (Settings → Secrets and variables → Actions → Secrets).
- **GHCR read access locally.** If the `wordle-go` package is private, log in once:
  ```bash
  gh auth token | docker login ghcr.io -u jdbennet2001 --password-stdin
  # or, with a PAT that has read:packages:
  # echo "$CR_PAT" | docker login ghcr.io -u jdbennet2001 --password-stdin
  ```

---

## Step 1 — Build and publish to GHCR

Trigger the GHCR build workflow:

1. GitHub → **Actions** → **Build and Publish GHCR Image** → **Run workflow**.
2. Wait for the run to complete green.

**Verify** the multi-arch image exists and is fresh:

```bash
docker buildx imagetools inspect ghcr.io/jdbennet2001/wordle-go:latest
```

✅ Checkpoint: output lists `linux/amd64` and `linux/arm64` manifests. Note the
top-level `Digest:` — you will compare it after the ECR copy.

---

## Step 2 — Deploy locally from GHCR (default configuration)

```bash
cd deploy
docker compose --env-file .env.ghcr up -d
```

**Verify** the container is up and pulling from GHCR:

```bash
docker compose --env-file .env.ghcr images   # image ref shows ghcr.io/...
docker compose --env-file .env.ghcr ps        # state = running / healthy
```

✅ Checkpoint: `wordle-wordle-go-1` is running, image is `ghcr.io/jdbennet2001/wordle-go:latest`.

---

## Step 3 — Check the UI (GHCR deployment)

Open http://localhost:2000 in a browser.

**Verify:**
- The Wordle board and on-screen keyboard render.
- Typing a 5-letter word and pressing Enter colours the tiles.

Or from the shell:

```bash
curl -s http://localhost:2000 | grep -io "wordle" | head -1   # -> wordle
```

✅ Checkpoint: UI is visible and interactive.

---

## Step 4 — Copy images to ECR

Run the mirror workflow (creates the ECR repository on first run):

1. GitHub → **Actions** → **mirror-to-ecr** → **Run workflow** (accept the default
   `manifest: deploy/images.yaml`).
2. Wait for the run to complete green.
3. Open the run summary and read the **Mirrored images** table.

**Verify** the image landed in ECR:

```bash
aws ecr describe-images \
  --repository-name wordle-go \
  --image-ids imageTag=latest \
  --region eu-west-1 \
  --query 'imageDetails[0].{tags:imageTags,digest:imageDigest,pushed:imagePushedAt}' \
  --output table
```

✅ Checkpoint: the repository exists, the image is tagged `latest` **and** `wordle`,
and its digest matches the GHCR digest from Step 1 (the copy preserves digests).

---

## Step 5 — Wipe the local deployment

Tear down the stack **and remove the cached GHCR image**, so the ECR redeploy is
forced to pull for real rather than reuse a local layer:

```bash
docker compose --env-file .env.ghcr down
docker rmi ghcr.io/jdbennet2001/wordle-go:latest
```

**Verify** nothing wordle-related remains:

```bash
docker compose --env-file .env.ghcr ps     # no services
docker images | grep wordle-go             # no rows (ignore exit status 1)
```

✅ Checkpoint: no running containers and no local `wordle-go` image.

---

## Step 6 — Redeploy from ECR

Authenticate Docker to ECR, then bring the stack up with the **ECR** env file:

```bash
aws ecr get-login-password --region eu-west-1 \
  | docker login --username AWS --password-stdin 612054226364.dkr.ecr.eu-west-1.amazonaws.com

docker compose --env-file .env.ecr up -d
```

**Verify** the image is now sourced from ECR:

```bash
docker compose --env-file .env.ecr images   # image ref shows 612054226364.dkr.ecr...
docker compose --env-file .env.ecr ps
```

✅ Checkpoint: `wordle-wordle-go-1` is running from
`612054226364.dkr.ecr.eu-west-1.amazonaws.com/wordle-go:latest`.

---

## Step 7 — Test the ECR deployment

Reload http://localhost:2000.

**Verify** the same UI renders and plays exactly as in Step 3.

```bash
curl -s http://localhost:2000 | grep -io "wordle" | head -1   # -> wordle
```

✅ **Test passes** if the UI is identical and functional — the app now runs from a
different registry with no change to the compose file, only the env file.

---

## Cleanup

```bash
# Stop and remove the local stack
docker compose --env-file .env.ecr down

# Optional: remove local images
docker rmi 612054226364.dkr.ecr.eu-west-1.amazonaws.com/wordle-go:latest

# Optional: tear down the ECR repository
#   GitHub → Actions → remove-ecr → Run workflow
#   set ecr-repository=wordle-go and type "wordle-go" into the confirm field
```

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `zsh: command not found: aws` (or `yq`) | Not installed, or zsh cached the miss — `brew install awscli yq` then `hash -r`. |
| `aws` → `Unable to locate credentials` | Run `aws configure` (see Install the tooling). |
| `docker compose up` GHCR pull → `denied` / `unauthorized` | Package is private — run the `docker login ghcr.io` step in Prerequisites. |
| ECR pull → `no basic auth credentials` | The 12h ECR login token expired or was never set — rerun the `aws ecr get-login-password | docker login` command. |
| ECR `describe-images` → `RepositoryNotFoundException` | The mirror workflow hasn't run, or ran against a different region/account than `.env.ecr`. |
| Port 2000 already in use | Change `HOST_PORT` in the env file (e.g. `HOST_PORT=2100`) and re-run `up`. |
| UI loads but tiles don't colour | Hard-refresh (cache-busting) and check the browser console; confirm `public/words.json` is present in the image. |
| Step 7 shows stale content | You didn't remove the local image in Step 5, so compose reused the cached GHCR layer. Repeat Step 5. |
