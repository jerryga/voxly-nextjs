locals {
  network_name = "${var.project_name}-${var.environment_name}"
}

resource "aws_vpc" "voxly" {
  count = var.create_network ? 1 : 0

  cidr_block           = var.vpc_cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(
    local.base_tags,
    {
      Name = "${local.network_name}-vpc"
      Role = "network"
    },
  )
}

resource "aws_internet_gateway" "voxly" {
  count = var.create_network ? 1 : 0

  vpc_id = aws_vpc.voxly[0].id

  tags = merge(
    local.base_tags,
    {
      Name = "${local.network_name}-igw"
    },
  )
}

resource "aws_subnet" "public" {
  count = var.create_network ? length(var.public_subnet_cidr_blocks) : 0

  vpc_id                  = aws_vpc.voxly[0].id
  cidr_block              = var.public_subnet_cidr_blocks[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(
    local.base_tags,
    {
      Name = "${local.network_name}-public-${count.index + 1}"
      Tier = "public"
    },
  )
}

resource "aws_subnet" "private" {
  count = var.create_network ? length(var.private_subnet_cidr_blocks) : 0

  vpc_id            = aws_vpc.voxly[0].id
  cidr_block        = var.private_subnet_cidr_blocks[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(
    local.base_tags,
    {
      Name = "${local.network_name}-private-${count.index + 1}"
      Tier = "private"
    },
  )
}

resource "aws_route_table" "public" {
  count = var.create_network ? 1 : 0

  vpc_id = aws_vpc.voxly[0].id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.voxly[0].id
  }

  tags = merge(
    local.base_tags,
    {
      Name = "${local.network_name}-public-rt"
    },
  )
}

resource "aws_route_table_association" "public" {
  count = var.create_network ? length(aws_subnet.public) : 0

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_eip" "nat" {
  count = var.create_network ? 1 : 0

  domain = "vpc"

  tags = merge(
    local.base_tags,
    {
      Name = "${local.network_name}-nat-eip"
    },
  )
}

resource "aws_nat_gateway" "voxly" {
  count = var.create_network ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id

  tags = merge(
    local.base_tags,
    {
      Name = "${local.network_name}-nat"
    },
  )

  depends_on = [aws_internet_gateway.voxly]
}

resource "aws_route_table" "private" {
  count = var.create_network ? 1 : 0

  vpc_id = aws_vpc.voxly[0].id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.voxly[0].id
  }

  tags = merge(
    local.base_tags,
    {
      Name = "${local.network_name}-private-rt"
    },
  )
}

resource "aws_route_table_association" "private" {
  count = var.create_network ? length(aws_subnet.private) : 0

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[0].id
}
