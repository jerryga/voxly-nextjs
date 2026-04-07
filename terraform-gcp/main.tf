locals {
  secret_ids = toset(values(var.secret_env_vars))
}

resource "google_project_service" "required" {
  for_each = var.enable_apis ? toset(var.service_apis) : toset([])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = var.artifact_registry_repository_id
  description   = "Container images for Voxly Cloud Run deployments"
  format        = var.artifact_registry_repository_format

  depends_on = [google_project_service.required]
}

resource "google_service_account" "cloud_run" {
  account_id   = var.service_account_id
  display_name = "Voxly Cloud Run runtime"

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret" "app" {
  for_each = local.secret_ids

  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "cloud_run_accessor" {
  for_each = google_secret_manager_secret.app

  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_cloud_run_v2_service" "app" {
  name                = var.service_name
  location            = var.region
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = google_service_account.cloud_run.email
    timeout                          = "${var.timeout_seconds}s"
    max_instance_request_concurrency = var.max_instance_request_concurrency

    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }

    containers {
      image = var.container_image

      ports {
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      dynamic "env" {
        for_each = var.plain_env_vars

        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_env_vars

        content {
          name = env.key

          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app[env.value].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  depends_on = [
    google_artifact_registry_repository.app,
    google_secret_manager_secret_iam_member.cloud_run_accessor,
    google_secret_manager_secret.app,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.allow_unauthenticated ? 1 : 0

  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
