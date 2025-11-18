# CDK to Pulumi Migration - EC2 Infrastructure

This Pulumi project is a migration from AWS CDK, managing EC2 instances with VPC, networking, and supporting infrastructure across three environments.

## Architecture

Each stack deploys:
- **VPC** with 2 public subnets across 2 availability zones
- **Internet Gateway** and routing configuration
- **Security Groups** for SSH access and EC2 instances
- **IAM Role** with SSM and CloudWatch permissions
- **S3 Bucket** for asset storage
- **EC2 Instance** (Amazon Linux 2023) with CloudWatch Agent

## Stacks

- **dev**: Development environment (m7g.large)
- **stg**: Staging environment (m7g.xlarge)
- **prod**: Production environment (m7g.xlarge2)

All stacks use ARM64 architecture (M7G instance family) and are deployed in us-west-2.

## Configuration

Each stack requires the following configuration:
- `aws:region`: AWS region (us-west-2)
- `instanceSize`: EC2 instance size (large, xlarge, xlarge2)
- `cpuType`: CPU architecture (ARM64 or X86)
- `logLevel`: Logging level (INFO, DEBUG, etc.)
- `sshPubKey`: (Optional) SSH public key for EC2 access

AWS credentials are provided via ESC environment: `aws-creds/neo-demo-dev`

## Asset Deployment

Place files in the `assets/sample/` directory. These will be uploaded to the S3 bucket and downloaded to EC2 instances at `/home/ec2-user/sample/` during initialization.

## Outputs

Each stack exports:
- VPC and subnet IDs
- Security group IDs
- EC2 instance details (ID, public IP, public DNS)
- SSM and SSH connection commands

## Migration from CDK

This project imports existing CDK-managed resources. The import IDs in the code need to be replaced with actual AWS resource IDs before running `pulumi up`.

### Import Process

1. Get resource IDs from existing CDK stacks
2. Replace placeholder import IDs in `index.ts`
3. Run `pulumi up` to import resources into Pulumi state
4. Verify all resources are correctly imported
5. Future updates will be managed by Pulumi

## Usage

```bash
# Select a stack
pulumi stack select dev

# Preview changes
pulumi preview

# Deploy changes
pulumi up

# Connect to EC2 instance via SSM
pulumi stack output ssmCommand

# Connect to EC2 instance via SSH
pulumi stack output sshCommand
```
