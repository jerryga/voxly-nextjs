# Voxly GCP Terraform Starter

This folder is the cost-effective Cloud Run starting point for Voxly.

It intentionally keeps the first migration small:

- Cloud Run for the Next.js runtime
- Artifact Registry for the container image
- Secret Manager secret containers for runtime secrets
- a dedicated Cloud Run runtime service account

It intentionally does not create these services in phase 1:

- Cloud SQL
- Memorystore
- VPC connector
- Cloud NAT
- external HTTP load balancer

That keeps idle cost low and avoids recreating the fixed-cost AWS architecture on GCP.

## What This Assumes

The first deployment continues using existing external dependencies:

- external Postgres
- S3-compatible object storage
- Stripe
- Deepgram
- OpenAI and/or Gemini
- Inngest

## Files

- [versions.tf](/Users/chason/Documents/GitHub/voxly-nextjs/terraform-gcp/versions.tf)
- [variables.tf](/Users/chason/Documents/GitHub/voxly-nextjs/terraform-gcp/variables.tf)
- [main.tf](/Users/chason/Documents/GitHub/voxly-nextjs/terraform-gcp/main.tf)
- [outputs.tf](/Users/chason/Documents/GitHub/voxly-nextjs/terraform-gcp/outputs.tf)
- [terraform.tfvars.example](/Users/chason/Documents/GitHub/voxly-nextjs/terraform-gcp/terraform.tfvars.example)

## Usage

From the project root:

```bash
cd terraform-gcp
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
```

After the first apply:

1. push the app image to Artifact Registry
2. create secret versions in Secret Manager for each required secret
3. run `terraform apply` again with the real image reference if needed
4. test the generated Cloud Run URL before pointing DNS at it

## Secret Handling

This starter creates Secret Manager secret containers only.

That is deliberate. It avoids storing secret values in Terraform state. Add secret versions separately with `gcloud secrets versions add` or another secure workflow after the secrets exist.

## Suggested First Cut

Use these defaults first:

- `min_instance_count = 0`
- `cpu = "1"`
- `memory = "512Mi"`
- `allow_unauthenticated = true`

That gives the app scale-to-zero behavior similar to Cloud Run’s cheapest operating mode.
