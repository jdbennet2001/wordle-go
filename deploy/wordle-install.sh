#!/usr/bin/env bash
#
# Wordle installer (for external developers).
#
# Hand this single file to a developer along with their ECR credentials.
# It preflight-checks their environment and credentials BEFORE doing any work,
# then pulls the deployment bundle from ECR and installs the product locally.
#
# Nothing in this file is secret — it is safe to email or share directly.
#
#   Usage:  ./wordle-install.sh
#
set -euo pipefail

# ---- configuration (not secret) -------------------------------------------
AWS_REGION="eu-west-1"
ECR_REGISTRY="612054226364.dkr.ecr.eu-west-1.amazonaws.com"
EXPECTED_ACCOUNT="612054226364"
BUNDLE_REPO="wordle-deploy"
BUNDLE_TAG="latest"
WORKDIR="./wordle-deploy"

BUNDLE_IMAGE="${ECR_REGISTRY}/${BUNDLE_REPO}:${BUNDLE_TAG}"

# ---- pretty output ---------------------------------------------------------
info() { printf '\033[0;34m[ ]\033[0m %s\n' "$*"; }
ok()   { printf '\033[0;32m[✓]\033[0m %s\n' "$*"; }
die()  { printf '\033[0;31m[✗] %s\033[0m\n' "$*" >&2; exit 1; }

echo "Wordle installer"
echo "================"

# ---- preflight 1: required tools ------------------------------------------
command -v aws >/dev/null 2>&1 \
  || die "AWS CLI not found. Install it, then re-run:
      macOS:  brew install awscli
      other:  https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"

command -v docker >/dev/null 2>&1 \
  || die "Docker not found. Install Docker Desktop and re-run:
      https://www.docker.com/products/docker-desktop/"
ok "aws and docker are installed."

# ---- preflight 2: docker daemon running -----------------------------------
docker info >/dev/null 2>&1 \
  || die "Docker is installed but not running. Start Docker Desktop, wait for it
      to report 'running', then re-run this script."
ok "Docker daemon is running."

# ---- preflight 3: AWS credentials present & valid -------------------------
info "Checking AWS credentials..."
ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) \
  || die "AWS credentials are missing or invalid.
      Configure the access key you were given, then re-run:
        aws configure
      (set the region to ${AWS_REGION})."

# ---- preflight 4: credentials belong to the expected account --------------
if [ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]; then
  die "These credentials are for AWS account '${ACCOUNT}', but this installer
      expects account '${EXPECTED_ACCOUNT}'. Double-check you configured the
      key you were issued for this product."
fi
ok "AWS credentials are valid (account ${ACCOUNT})."

# ---- preflight 5: ECR login works -----------------------------------------
info "Authenticating Docker to ECR..."
aws ecr get-login-password --region "$AWS_REGION" 2>/dev/null \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY" >/dev/null 2>&1 \
  || die "ECR login failed. Your credentials are valid but may not have ECR
      access. Contact the maintainer to confirm your key was granted access."
ok "Authenticated to ${ECR_REGISTRY}."

# ---- preflight 6: bundle is actually readable -----------------------------
info "Checking access to the deployment bundle..."
aws ecr describe-images \
  --repository-name "$BUNDLE_REPO" --image-ids imageTag="$BUNDLE_TAG" \
  --region "$AWS_REGION" >/dev/null 2>&1 \
  || die "Cannot read '${BUNDLE_REPO}:${BUNDLE_TAG}' in ECR. Either the bundle has
      not been published yet, or your key was not granted read access to it.
      Contact the maintainer."
ok "Deployment bundle is accessible."

echo
echo "All checks passed. Installing..."
echo

# ---- download the bundle (plain docker; no extra tooling) -----------------
info "Downloading install bundle from ECR..."
docker pull "$BUNDLE_IMAGE" >/dev/null
cid=$(docker create "$BUNDLE_IMAGE")
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"
docker cp "$cid:/deploy/." "$WORKDIR/"
docker rm "$cid" >/dev/null
ok "Bundle downloaded to ${WORKDIR}/"

# ---- run the bundle's own installer ---------------------------------------
cd "$WORKDIR"
chmod +x install.sh 2>/dev/null || true
./install.sh
