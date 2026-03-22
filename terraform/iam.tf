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
  count = var.create_beanstalk_iam_roles ? 1 : 0

  role       = aws_iam_role.beanstalk_service[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy"
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
