#!/usr/bin/env bash
# Build docker/ and push the image to ECR.
# Uses the caller's AWS credentials. AWS_REGION defaults to us-east-1.
# ECR_REPOSITORY defaults to sa-alert-bot.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
region="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
name="${ECR_REPOSITORY:-sa-alert-bot}"
account="$(aws sts get-caller-identity --query Account --output text)"
registry="${account}.dkr.ecr.${region}.amazonaws.com"
image="${registry}/${name}"

aws ecr describe-repositories --repository-names "$name" --region "$region" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$name" --region "$region" >/dev/null

aws ecr get-login-password --region "$region" \
  | docker login --username AWS --password-stdin "$registry"

docker build -f "$here/Dockerfile" -t "$name" "$here"
docker tag "${name}:latest" "${image}:latest"
docker push "${image}:latest"
echo "${image}:latest"
