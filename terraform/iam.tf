data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "beanstalk_service_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["elasticbeanstalk.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "beanstalk_ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "beanstalk_service" {
  count = var.create_beanstalk_iam_roles ? 1 : 0

  name               = "${var.project_name}-${var.environment_name}-beanstalk-service"
  assume_role_policy = data.aws_iam_policy_document.beanstalk_service_assume_role.json

  tags = local.base_tags
}

resource "aws_iam_role_policy_attachment" "beanstalk_service_enhanced_health" {
  count = var.create_beanstalk_iam_roles ? 1 : 0

  role       = aws_iam_role.beanstalk_service[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkEnhancedHealth"
}

resource "aws_iam_role_policy_attachment" "beanstalk_service_managed_updates" {
  count = var.create_beanstalk_iam_roles && var.attach_beanstalk_managed_updates_policy ? 1 : 0

  role       = aws_iam_role.beanstalk_service[0].name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy"
}

resource "aws_iam_role" "beanstalk_ec2" {
  count = var.create_beanstalk_iam_roles ? 1 : 0

  name               = "${var.project_name}-${var.environment_name}-beanstalk-ec2"
  assume_role_policy = data.aws_iam_policy_document.beanstalk_ec2_assume_role.json

  tags = local.base_tags
}

resource "aws_iam_role_policy_attachment" "beanstalk_ec2_web_tier" {
  count = var.create_beanstalk_iam_roles ? 1 : 0

  role       = aws_iam_role.beanstalk_ec2[0].name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier"
}

data "aws_iam_policy_document" "beanstalk_s3_access" {
  statement {
    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation",
    ]
    resources = [aws_s3_bucket.uploads.arn]
  }

  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }
}

resource "aws_iam_role_policy" "beanstalk_ec2_s3_access" {
  count = var.create_beanstalk_iam_roles ? 1 : 0

  name   = "${var.project_name}-${var.environment_name}-s3-access"
  role   = aws_iam_role.beanstalk_ec2[0].id
  policy = data.aws_iam_policy_document.beanstalk_s3_access.json
}

resource "aws_iam_instance_profile" "beanstalk_ec2" {
  count = var.create_beanstalk_iam_roles ? 1 : 0

  name = "${var.project_name}-${var.environment_name}-beanstalk-ec2-profile"
  role = aws_iam_role.beanstalk_ec2[0].name

  tags = local.base_tags
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  count = var.create_github_actions_oidc_role ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = local.base_tags
}

data "aws_iam_policy_document" "github_actions_assume_role" {
  count = var.create_github_actions_oidc_role ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions[0].arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repository}:environment:${var.github_environment_name}",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  count = var.create_github_actions_oidc_role ? 1 : 0

  name               = var.github_actions_role_name
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role[0].json

  tags = local.base_tags
}

data "aws_iam_policy_document" "github_actions_deploy" {
  count = var.create_github_actions_oidc_role ? 1 : 0

  statement {
    actions = [
      "s3:ListBucket",
    ]
    resources = [aws_s3_bucket.deploy_artifacts.arn]
  }

  statement {
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
    ]
    resources = ["${aws_s3_bucket.deploy_artifacts.arn}/*"]
  }

  statement {
    actions = [
      "s3:CreateBucket",
      "s3:ListBucket",
      "s3:GetBucketLocation",
    ]
    resources = [
      "arn:aws:s3:::elasticbeanstalk-${var.aws_region}-${data.aws_caller_identity.current.account_id}",
    ]
  }

  statement {
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
    ]
    resources = [
      "arn:aws:s3:::elasticbeanstalk-${var.aws_region}-${data.aws_caller_identity.current.account_id}/*",
    ]
  }

  statement {
    actions = [
      "elasticbeanstalk:CreateApplicationVersion",
      "elasticbeanstalk:UpdateEnvironment",
      "elasticbeanstalk:DescribeApplications",
      "elasticbeanstalk:DescribeApplicationVersions",
      "elasticbeanstalk:DescribeEnvironments",
      "elasticbeanstalk:DescribeEvents",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  count = var.create_github_actions_oidc_role ? 1 : 0

  name   = "${var.project_name}-${var.environment_name}-github-actions-deploy"
  role   = aws_iam_role.github_actions_deploy[0].id
  policy = data.aws_iam_policy_document.github_actions_deploy[0].json
}
