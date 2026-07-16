# Manual Deployment Test Plan

End-to-end validation of both delivery paths for the wordle app:

- **GHCR path** — the maintainer builds the image and deploys it locally with
  docker compose.
- **ECR path** — an external developer runs the single `wordle-install.sh`
  script, which downloads the install bundle from ECR and deploys the app with
  docker compose.

If the app renders and plays identically from both paths — starting from a clean
Docker each time — the mechanism is proven.

## What this validates

1. The required tooling (aws, docker) is installed and credentials work.
2. CI builds the multi-arch image and publishes it to GHCR.
3. From a clean Docker, the compose config deploys it locally from GHCR and the
   UI works.
4. The app image and the install bundle are published to ECR.
5. From a clean Docker, the `wordle-install.sh` script (the real external-user
   flow) downloads from ECR and deploys, and the UI works identically.

## Concrete values used below

| Thing | Value |
| --- | --- |
| GHCR image | `ghcr.io/jdbennet2001/wordle-go` |
| ECR image | `612054226364.dkr.ecr.eu-west-1.amazonaws.com/wordle-go` |
| ECR install bundle | `612054226364.dkr.ecr.eu-west-1.amazonaws.com/wordle-deploy` |
| AWS account / region | `612054226364` / `eu-west-1` |
| Local URL | http://localhost:2000 |
| Compose project | `wordle` (containers named `wordle-*`) |

Maintainer commands run from the `deploy/` directory unless stated otherwise.

## Install the tooling (one-time, macOS)

```bash
brew install awscli yq   # awscli = AWS CLI v2; yq = mikefarah's Go yq (used by the workflows)
```

If a freshly installed command still reports `command not found`, zsh has cached
the old lookup — clear it (or open a new terminal):

```bash
hash -r
```

`docker` and `docker compose` ship with Docker Desktop. `gh` (GitHub CLI) is
optional, used only for the GHCR login shortcut.

Configure AWS credentials for account `612054226364` (reuse the same IAM access
key stored in the GitHub secrets), region matching `.env.ecr`:

```bash
aws configure
# AWS Access Key ID     [None]: AKIA…         <- same key as the GitHub secret
# Default region name   [None]: eu-west-1
# Default output format [None]: json
```

> The AWS CLI may suggest `aws login` in an error — ignore it; `aws configure`
> is the correct command for access keys.

## Prerequisites (for the maintainer steps)

- **GitHub repo secrets set**: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
  (Settings → Secrets and variables → Actions → Secrets).
- **GHCR read access locally.** If the `wordle-go` package is private, log in once:
  ```bash
  gh auth token | docker login ghcr.io -u jdbennet2001 --password-stdin
  # or, with a PAT that has read:packages:
  # echo "$CR_PAT" | docker login ghcr.io -u jdbennet2001 --password-stdin
  ```

---

## Step 1 — Validate tooling and access

Confirm the environment is ready before doing anything:

```bash
docker version                 # client + server both report; daemon is up
docker compose version         # v2/v5 present
aws --version                  # aws-cli/2.x
aws sts get-caller-identity    # returns account 612054226364
```

✅ Checkpoint: all four succeed and `get-caller-identity` shows account
`612054226364`. If any fail, see *Install the tooling* above.

---

## Step 2 — Build and publish to GHCR

1. GitHub → **Actions** → **Build and Publish GHCR Image** → **Run workflow**.
2. Wait for the run to complete green.

**Verify** the multi-arch image exists and is fresh:

```bash
docker buildx imagetools inspect ghcr.io/jdbennet2001/wordle-go:latest
```

✅ Checkpoint: output lists `linux/amd64` and `linux/arm64` manifests. Note the
top-level `Digest:` — you can compare it after the ECR copy.

---

## Step 3 — Start from a clean Docker

Remove any previous wordle stack and cached wordle images so the deploy is a
genuine from-scratch pull:

```bash
cd deploy
docker compose --env-file .env.ghcr down --remove-orphans 2>/dev/null || true
docker rmi ghcr.io/jdbennet2001/wordle-go:latest \
           612054226364.dkr.ecr.eu-west-1.amazonaws.com/wordle-go:latest 2>/dev/null || true
```

**Verify** nothing wordle-related remains:

```bash
docker compose --env-file .env.ghcr ps    # no services
docker images | grep wordle-go            # no rows (ignore exit status 1)
```

✅ Checkpoint: no running containers and no local `wordle-go` image.

---

## Step 4 — Deploy locally from GHCR (docker compose)

```bash
docker compose --env-file .env.ghcr up -d
```

**Verify** the container is up and was pulled from GHCR:

```bash
docker compose --env-file .env.ghcr images   # image ref shows ghcr.io/...
docker compose --env-file .env.ghcr ps        # state = running
```

✅ Checkpoint: `wordle-wordle-go-1` is running from `ghcr.io/jdbennet2001/wordle-go:latest`.

---

## Step 5 — Check the app is running (GHCR)

Open http://localhost:2000 in a browser.

**Verify:** the board and on-screen keyboard render, and typing a 5-letter word
then Enter colours the tiles. Or from the shell:

```bash
curl -s http://localhost:2000 | grep -io "wordle" | head -1   # -> wordle
```

✅ Checkpoint: UI is visible and interactive.

---

## Step 6 — Clear the docker compose system

Tear the stack down and remove the cached GHCR image, so the ECR path that
follows cannot silently reuse a local layer:

```bash
docker compose --env-file .env.ghcr down --remove-orphans
docker rmi ghcr.io/jdbennet2001/wordle-go:latest 2>/dev/null || true
```

**Verify:**

```bash
docker compose --env-file .env.ghcr ps    # no services
docker images | grep wordle-go            # no rows
```

✅ Checkpoint: back to a clean Docker.

---

## Step 7 — Publish to ECR (app image + install bundle)

The script in the next step pulls from ECR, so populate ECR first. Both workflows
create their repositories on first run.

1. GitHub → **Actions** → **mirror-to-ecr** → **Run workflow** (mirrors
   `wordle-go` GHCR → ECR). Wait for green.
2. GitHub → **Actions** → **package-deploy** → **Run workflow** (builds and pushes
   the `wordle-deploy` install bundle). Wait for green.

**Verify** both repositories now hold an image:

```bash
aws ecr describe-images --repository-name wordle-go     --image-ids imageTag=latest --region eu-west-1 \
  --query 'imageDetails[0].imageDigest' --output text
aws ecr describe-images --repository-name wordle-deploy  --image-ids imageTag=latest --region eu-west-1 \
  --query 'imageDetails[0].imageDigest' --output text
```

✅ Checkpoint: both commands print a `sha256:…` digest. The `wordle-go` digest
matches the GHCR digest from Step 2 (the copy preserves digests).

---

## Step 8 — Install from ECR using the script

Simulate the external developer: run the one script from a **fresh directory**
(nothing but the script and their AWS credentials), not from inside `deploy/`.

```bash
mkdir -p ~/wordle-test && cp deploy/wordle-install.sh ~/wordle-test/
cd ~/wordle-test
./wordle-install.sh
```

The script preflight-checks tools, the Docker daemon, and the AWS credentials;
then logs in to ECR, downloads the bundle with `docker create`/`docker cp`, and
runs the bundle's `install.sh` (`docker compose --env-file .env.ecr up -d`).

**Verify** the app is running from ECR:

```bash
cd ~/wordle-test/wordle-deploy
docker compose --env-file .env.ecr images   # image ref shows 612054226364.dkr.ecr...
docker compose --env-file .env.ecr ps
```

✅ Checkpoint: preflight prints all `[✓]`, and `wordle-wordle-go-1` is running from
`612054226364.dkr.ecr.eu-west-1.amazonaws.com/wordle-go:latest`.

---

## Step 9 — Check the app is running (ECR)

Reload http://localhost:2000.

**Verify** the same UI renders and plays exactly as in Step 5.

```bash
curl -s http://localhost:2000 | grep -io "wordle" | head -1   # -> wordle
```

✅ **Test passes** if the app is identical and functional — installed by an
external-style developer straight from ECR, with no GitHub access.

---

## Cleanup

```bash
# Stop and remove the ECR-installed stack
cd ~/wordle-test/wordle-deploy && docker compose --env-file .env.ecr down --remove-orphans

# Optional: remove local images and the scratch dir
docker rmi 612054226364.dkr.ecr.eu-west-1.amazonaws.com/wordle-go:latest 2>/dev/null || true
rm -rf ~/wordle-test

# Optional: tear down the ECR repositories
#   GitHub → Actions → remove-ecr → Run workflow, once per repo
#   (ecr-repository=wordle-go, then wordle-deploy), typing the name to confirm
```

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `zsh: command not found: aws` (or `yq`) | Not installed, or zsh cached the miss — `brew install awscli yq` then `hash -r`. |
| `aws` → `Unable to locate credentials` | Run `aws configure` (see Install the tooling). |
| `docker compose up` GHCR pull → `denied` / `unauthorized` | Package is private — run the `docker login ghcr.io` step in Prerequisites. |
| `wordle-install.sh` fails a `[✗]` preflight check | The message says which of: missing tool, daemon down, bad/missing creds, wrong account, ECR login, or bundle not readable. Fix that item and re-run. |
| ECR pull → `no basic auth credentials` | The 12h ECR login token expired — the script re-logs in, so just re-run it; for manual compose, rerun `aws ecr get-login-password \| docker login`. |
| `describe-images` → `RepositoryNotFoundException` | Step 7 hasn't run for that repo, or it ran against a different region/account than `.env.ecr`. |
| Port 2000 already in use | A previous stack is still up — run the Step 6 teardown; or change `HOST_PORT` in the env file. |
| Step 9 shows stale content | A cached image was reused — repeat the Step 6 clear (and confirm no local `wordle-go` image) before the ECR install. |
