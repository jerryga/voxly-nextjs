#!/usr/bin/env bash

set -euo pipefail

AWS_ACCOUNT_ID="<AWS_ACCOUNT_ID>"
AWS_REGION="ca-central-1"
DEPLOY_BUCKET_NAME="<DEPLOY_BUCKET_NAME>"
ROLE_NAME="voxly-github-actions-beanstalk-deploy"
POLICY_NAME="voxly-github-actions-beanstalk-deploy-policy"

WORK_DIR="$(cd "$(dirname "$0")" && pwd)"
TRUST_POLICY_FILE="$WORK_DIR/github-oidc-trust-policy.example.json"
PERMISSIONS_POLICY_FILE="$WORK_DIR/github-actions-beanstalk-deploy-policy.example.json"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

TRUST_POLICY_RENDERED="$TMP_DIR/trust-policy.json"
PERMISSIONS_POLICY_RENDERED="$TMP_DIR/permissions-policy.json"

sed "s#<AWS_ACCOUNT_ID>#$AWS_ACCOUNT_ID#g" \
  "$TRUST_POLICY_FILE" > "$TRUST_POLICY_RENDERED"

sed "s#<DEPLOY_BUCKET_NAME>#$DEPLOY_BUCKET_NAME#g" \
  "$PERMISSIONS_POLICY_FILE" > "$PERMISSIONS_POLICY_RENDERED"

aws iam create-open-id-connect-provider \
  --url "https://token.actions.githubusercontent.com" \
  --client-id-list "sts.amazonaws.com" \
  --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" || true

aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document "file://$TRUST_POLICY_RENDERED"

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "file://$PERMISSIONS_POLICY_RENDERED"

echo "Created role:"
echo "arn:aws:iam::$AWS_ACCOUNT_ID:role/$ROLE_NAME"
echo
echo "Add this ARN to the GitHub secret AWS_ROLE_TO_ASSUME."
