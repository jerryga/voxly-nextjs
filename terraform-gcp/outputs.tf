output "cloud_run_service_name" {
  description = "Cloud Run service name."
  value       = google_cloud_run_v2_service.app.name
}

output "cloud_run_service_uri" {
  description = "Cloud Run service URL."
  value       = google_cloud_run_v2_service.app.uri
}

output "cloud_run_service_account_email" {
  description = "Service account email used by the Cloud Run service."
  value       = google_service_account.cloud_run.email
}

output "artifact_registry_repository_name" {
  description = "Artifact Registry repository name."
  value       = google_artifact_registry_repository.app.name
}

output "artifact_registry_repository_url" {
  description = "Artifact Registry Docker repository URL."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "secret_manager_secret_ids" {
  description = "Secret Manager secret IDs created for runtime secret injection."
  value       = [for secret in google_secret_manager_secret.app : secret.secret_id]
}
