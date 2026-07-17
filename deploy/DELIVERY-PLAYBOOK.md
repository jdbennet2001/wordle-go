# Container Delivery Playbook — GHCR → ECR → one-command install

A reusable prompt for reproducing the "build once, govern centrally, run anywhere"
container supply chain on another repository — including multi-container repos.

## How to use this file

Open Claude Code (or any capable coding agent) in the target repository and say:

> Read `DELIVERY-PLAYBOOK.md` and set up the same GHCR → ECR delivery pipeline for
> this repo. Ask me for the parameters first, then build all deliverables.

That's the minimal-effort path — no installation, works in any repo. Everything
the agent needs is below.

> Prefer a slash command? Promote this file to a skill: drop it at
> `~/.claude/skills/ecr-delivery/SKILL.md`, add YAML frontmatter
> (`name: ecr-delivery`, `description: Set up a GHCR→ECR container delivery
> pipeline with install bundle, test plan, and infographic`), and invoke with
> `/ecr-delivery`. The body below works unchanged as the skill instructions.

---

## 0. Parameters to gather first

Ask the user (or infer from the repo) and record these before building:

| Parameter | Example | Notes |
| --- | --- | --- |
| `GHCR_OWNER` | `jdbennet2001` | GitHub owner/namespace of the source images |
| `AWS_ACCOUNT_ID` | `612054226364` | target AWS account |
| `AWS_REGION` | `eu-west-1` | region for the ECR repositories |
| `REPO_PREFIX` | `myapp-` | shared prefix for all ECR repos (enables the teardown sweep + one IAM policy) |
| `SERVICES` | see below | list of `{name, repository, tag, aliases?, digest?, source?}` |
| `PRODUCT` | `myapp` | short name → compose project + `<PRODUCT>-install.sh` |
| `HOST_PORT` / container port | `2000` → `3000` | per public-facing service |

For a **multi-container** repo, enumerate every deployable image as a service.
Confirm each image basename is identical across GHCR and ECR (keep them so — it
is what lets one `${REGISTRY}` variable switch registries).

---

## 1. Design principles (make the same choices)

1. **One manifest is the single source of truth** (`deploy/images.yaml`): it drives
   both the mirror workflow and the compose `.env` values. Never hand-maintain two
   lists.
2. **Copy, don't rebuild.** Mirror GHCR→ECR with `docker buildx imagetools create`,
   which copies the full multi-arch manifest registry-to-registry and **preserves
   the digest**. A `@sha256:` reference is therefore valid against either registry.
3. **Switch registries with a variable, not a generated file.** One canonical
   `docker-compose.yml` using `${REGISTRY}/<repository>:<tag>`; select GHCR or ECR
   purely by `--env-file`.
4. **Secrets as inputs.** Workflows take AWS keys via `workflow_call` `secrets:`
   (for callers) and read repo secrets on `workflow_dispatch`. Never pass secrets
   as dispatch inputs (they get logged).
5. **Create repos on first use** (`describe-repositories || create-repository`,
   `scanOnPush=true`). ECR does not auto-create on push.
6. **Ship the installer through the same registry.** Package the compose file +
   scripts into a tiny **assets image** (`FROM busybox`) so consumers fetch it with
   plain `docker create`/`docker cp` — no extra tooling (no oras). Same credential
   as the image pull.
7. **Preflight before work.** The handed-out install script validates tools,
   daemon, credentials, account, ECR login, and bundle-readability *before* doing
   anything — clear errors cut support calls.
8. **Destructive ops are explicit.** Teardown is a prefix sweep guarded by a typed
   confirmation; reject empty/`*` prefixes.

---

## 2. Deliverables (file tree)

```
deploy/
  images.yaml              # manifest: registries + aws.region + services map
  docker-compose.yml       # canonical, ${REGISTRY}/<repo>:<tag> per service
  .env.ghcr                # REGISTRY = ghcr.io/<owner>
  .env.ecr                 # REGISTRY = <account>.dkr.ecr.<region>.amazonaws.com
  Dockerfile.deploy        # busybox assets image: compose + .env.ecr + install.sh
  install.sh               # inside bundle: docker compose --env-file .env.ecr up -d
  <PRODUCT>-install.sh     # handed to external devs: preflight + login + pull + install
  TEST-PLAN.md             # end-to-end manual validation
  pipeline.svg / .png      # the infographic
.github/workflows/
  mirror-to-ecr.yml        # manifest-driven copy GHCR -> ECR (loops services)
  package-deploy.yml       # build + push the install bundle to ECR
  remove-ecr.yml           # prefix-sweep teardown
```

(Assumes a `publish-ghcr` build workflow already exists. If not, create one that
builds multi-arch and pushes `ghcr.io/<owner>/<repo>` per service.)

---

## 3. Manifest schema (`deploy/images.yaml`)

```yaml
registries:
  ghcr: ghcr.io/<GHCR_OWNER>
  ecr:  <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com
aws:
  region: <AWS_REGION>
services:                    # one entry per deployable image
  <service-name>:
    repository: <basename>   # identical in both registries; defaults to the key
    tag: latest              # defaults to latest
    aliases: [<friendly>]    # optional extra ECR tags
    # digest: sha256:...     # optional immutable pin
    # source: docker.io/...  # optional, only for third-party images outside the ghcr prefix
```

**yq gotchas** (use mikefarah yq v4 — `brew install yq`, NOT the python one):
- Absent keys print the literal `null`; default in bash: `[ "$x" = "null" ] && x=default`.
- `length` of null is `0` (safe alias-loop guard).
- Dynamic map keys (may contain hyphens) must use `strenv`:
  `svc="$svc" yq '.services[strenv(svc)].repository' file`.
- Iterate services: `yq '.services | keys | .[]' file`.

---

## 4. Workflows (behaviour spec)

**mirror-to-ecr.yml** — inputs: `manifest` (default `deploy/images.yaml`); secrets:
AWS keys. Load `registries`/`aws.region` from the manifest in a first step (so
region flows into `configure-aws-credentials`). For each service: resolve source
(`<ghcr>/<repository>` unless `source` overrides), `describe||create` the ECR repo,
then `docker buildx imagetools create --tag <ecr>/<repo>:<tag> [--tag alias...]
<src>`. Write a Service/Reference/Digest table to `$GITHUB_STEP_SUMMARY`.

**package-deploy.yml** — build `deploy/Dockerfile.deploy` (context `deploy/`,
platforms amd64+arm64), create the `<PREFIX>deploy` repo if missing, push. Reads
registry/region from the manifest.

**remove-ecr.yml** — prefix sweep. Inputs: `aws-region`, `prefix` (default
`<REPO_PREFIX>`), `confirm` (required). Reject empty/`*` prefix; require
`confirm == prefix`. List with
`aws ecr describe-repositories --query "repositories[?starts_with(repositoryName,'<prefix>')].repositoryName"`
and `delete-repository --force` each. Idempotent when nothing matches.

All three: `workflow_dispatch` + `workflow_call` (with `secrets:` block).

---

## 5. Compose + env

```yaml
# deploy/docker-compose.yml
name: <PRODUCT>
services:
  <service-name>:
    image: ${REGISTRY}/<repository>:${TAG:-latest}
    ports: ["${HOST_PORT:-2000}:3000"]     # only for public-facing services
    restart: unless-stopped
  # ...one block per service
```

`.env.ghcr` → `REGISTRY=ghcr.io/<owner>`; `.env.ecr` →
`REGISTRY=<account>.dkr.ecr.<region>.amazonaws.com`. Both set `TAG` and any ports.
For multi-container, either share one `${REGISTRY}` (basenames aligned) or use
per-service `${SVC_IMAGE}` vars if paths diverge.

---

## 6. Install scripts

**`deploy/install.sh`** (inside bundle): `cd "$(dirname "$0")"`,
`docker compose --env-file .env.ecr up -d`, print the URL(s).

**`deploy/<PRODUCT>-install.sh`** (handed to developers; no secrets in it):
hardcode `AWS_REGION`, `ECR_REGISTRY`, `EXPECTED_ACCOUNT`, bundle repo/tag. Run
`set -euo pipefail`, then six preflight checks, each with an actionable message:

1. `command -v aws` / `command -v docker`
2. `docker info` (daemon up)
3. `aws sts get-caller-identity` (creds valid) — capture Account
4. Account == `EXPECTED_ACCOUNT`
5. `aws ecr get-login-password | docker login` succeeds
6. `aws ecr describe-images` on the bundle repo (readable / published)

Only then: `docker pull` the bundle, `docker create` + `docker cp $cid:/deploy/. ./<dir>`,
`docker rm`, `cd`, `./install.sh`.

**IAM for external devs:** one read-only policy scoped to
`arn:aws:ecr:<region>:<account>:repository/<PREFIX>*` (covers every service image
*and* the bundle) plus `ecr:GetAuthorizationToken` on `*`. One group, one user +
access key per developer; revoke by deleting the key.

---

## 7. Infographic recipe (the exact method used)

1. Hand-author a landscape **SVG** (1920×1080) — dark bg, `PRODUCE` group of image
   nodes on the left flowing into a glowing central **AWS ECR** hub, then a
   `CONSUME` group (install script → docker compose → running app) on the right.
   For multi-container: show the app images as a small stack/column feeding the hub,
   and list each repo inside the hub card.
2. Wrap it in a full-bleed HTML page and render with **headless Chrome** at 2×:
   ```bash
   { printf '%s' '<!doctype html><meta charset=utf-8><style>html,body{margin:0;padding:0;background:#0A0E1A}svg{display:block}</style>'; cat pipeline.svg; } > page.html
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
     --hide-scrollbars --force-device-scale-factor=2 --window-size=1920,1080 \
     --screenshot=pipeline.png "file://$PWD/page.html"
   ```
   → crisp 3840×2160 PNG. **Then Read the PNG and iterate** — fix clipped labels,
   balance empty bands with a value-prop row, etc.
3. Keep title punchy ("Build once. Govern centrally. Run anywhere.") and add a
   value-prop row for the exec audience (governed / reproducible / zero-friction).

---

## 8. Validate before finishing

- `yq '.services | keys | .[]' deploy/images.yaml` lists all services.
- YAML parses: every workflow + compose (`ruby -ryaml -e "YAML.load_file('f')"` or
  `yq`).
- `bash -n` each script.
- `docker compose --env-file .env.ghcr config --images` and `--env-file .env.ecr`
  resolve to the right refs.
- Dry-run the mirror loop locally (print, don't push) against the manifest.
- Render the infographic and **view it**.

---

## 9. Manual test flow (put in TEST-PLAN.md)

1. Validate tooling + `aws sts get-caller-identity`.
2. Build + publish to GHCR.
3. Start from a clean Docker (`compose down` + `docker rmi` every image).
4. `compose --env-file .env.ghcr up -d`; check each app.
5. Clear the compose system again (force real pulls next).
6. Publish to ECR: run `mirror-to-ecr` **and** `package-deploy` (both needed).
7. From a fresh dir, run `<PRODUCT>-install.sh` (the external-dev path).
8. Check every app runs identically.
9. Cleanup: `remove-ecr` with `prefix=<REPO_PREFIX>` (one run clears all).

---

## 10. Gotchas learned (save yourself the round-trips)

- Install missing CLIs with Homebrew: `brew install awscli yq`; after install run
  `hash -r` (zsh caches "command not found").
- The AWS CLI may suggest `aws login` on a creds error — wrong; it's `aws configure`.
- ECR never auto-creates repositories; both publish workflows must create-if-missing.
- In tests, always `docker rmi` the local image between GHCR and ECR runs or compose
  silently reuses the cached layer and you're not really testing the new registry.
- Running the mirror only creates the *image* repo; the *bundle* repo appears only
  after `package-deploy` runs — a `RepositoryNotFoundException` on the bundle means
  that workflow hasn't run yet.
