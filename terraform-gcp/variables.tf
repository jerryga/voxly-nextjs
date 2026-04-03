variable "project_id" {
  description = "GCP project ID used for the Cloud Run deployment."
  type        = string
}

variable "region" {
  description = "GCP region for Artifact Registry and Cloud Run."
  type        = string
  default     = "northamerica-northeast1"
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "voxly"
}

variable "artifact_registry_repository_id" {
  description = "Artifact Registry Docker repository ID."
  type        = string
  default     = "voxly"
}

variable "artifact_registry_repository_format" {
  description = "Artifact Registry repository format."
  type        = string
  default     = "DOCKER"
}

variable "container_image" {
  description = "Fully qualified container image URL to deploy to Cloud Run."
  type        = string
}

variable "service_account_id" {
  description = "Service account ID for the Cloud Run runtime identity."
  type        = string
  default     = "voxly-cloud-run"
}

variable "min_instance_count" {
  description = "Minimum number of Cloud Run instances to keep warm."
  type        = number
  default     = 0
}

variable "max_instance_count" {
  description = "Maximum number of Cloud Run instances."
  type        = number
  default     = 3
}

variable "container_port" {
  description = "Port exposed by the application container."
  type        = number
  default     = 8080
}

variable "timeout_seconds" {
  description = "Request timeout for the Cloud Run service."
  type        = number
  default     = 900
}

variable "cpu" {
  description = "CPU limit for the Cloud Run container."
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit for the Cloud Run container."
  type        = string
  default     = "512Mi"
}

variable "max_instance_request_concurrency" {
  description = "Maximum concurrent requests per Cloud Run instance."
  type        = number
  default     = 20
}

variable "allow_unauthenticated" {
  description = "Whether the Cloud Run service should be publicly invokable."
  type        = bool
  default     = true
}

variable "plain_env_vars" {
  description = "Non-secret environment variables to inject into Cloud Run."
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Map of environment variable name to Secret Manager secret ID."
  type        = map(string)
  default     = {}
}

variable "enable_apis" {
  description = "Whether Terraform should enable the required GCP APIs."
  type        = bool
  default     = true
}

variable "service_apis" {
  description = "GCP APIs required for the cost-effective Cloud Run deployment."
  type        = list(string)
  default = [
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
  ]
}
