# CDK to Pulumi Migration Guide

## Overview

This document describes the migration process from AWS CDK to Pulumi for the EC2 infrastructure across three environments (dev, stg, prod).

## Migration Strategy

The migration uses Pulumi's **import resource option** to adopt existing CDK-managed resources without recreating them. This ensures zero downtime and maintains all existing resource IDs and configurations.

## Pre-Migration State

### CDK Stacks
- **EC2-Dev**: Development environment with m7g.large instance
- **EC2-Stg**: Staging environment with m7g.xlarge instance  
- **EC2-Prod**: Production environment with m7g.xlarge2 instance

### Resources per Stack
Each CDK stack manages:
- VPC with 2 public subnets across 2 AZs
- Internet Gateway and routing
- 2 Security Groups (SSH and EC2 instance)
- IAM Role with SSM and CloudWatch policies
- Instance Profile
- S3 Bucket for assets
- EC2 Instance (Amazon Linux 2023, ARM64)

## Migration Process

### Phase 1: Import Resources (First Deployment)

When you run `pulumi up` for the first time on each stack, Pulumi will:

1. **Import existing resources** using the physical IDs specified in `resource-mappings.ts`
2. **Adopt resources into Pulumi state** without making any changes
3. **Detect existing routes** and may show them as needing to be created (this is expected)

### Phase 2: Reconcile Routes

After the initial import, routes may need to be reconciled:
- Routes are managed differently between CDK and Pulumi
- The first `pulumi up` after import may show routes as needing updates
- This is safe and expected - approve the changes

### Phase 3: Ongoing Management

After successful import and reconciliation:
- All resources are managed by Pulumi
- Future changes are made through Pulumi code
- CDK stacks can be safely deleted from CloudFormation (optional)

## Step-by-Step Migration

### 1. Verify Current State

```bash
# Check CDK stacks are deployed
aws cloudformation list-stacks --region us-west-2 \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `EC2`)]'
```

### 2. Import Dev Stack

```bash
cd cdk-converted
pulumi stack select dev
pulumi up
```

**Expected output:**
- Pulumi will show it's importing existing resources
- Routes may show as "create" operations (this is normal)
- Review the plan carefully
- Type "yes" to proceed

### 3. Import Stg Stack

```bash
pulumi stack select stg
pulumi up
```

Follow the same process as dev stack.

### 4. Import Prod Stack

```bash
pulumi stack select prod
pulumi up
```

Follow the same process as dev and stg stacks.

### 5. Verify Migration

After each stack import, verify:

```bash
# Check instance is running
pulumi stack output instanceId
pulumi stack output instancePublicDns

# Test SSM access
pulumi stack output ssmCommand

# Test SSH access (if SSH key configured)
pulumi stack output sshCommand
```

## Resource Mapping

The `resource-mappings.ts` file contains the physical resource IDs for each stack. These IDs were extracted from the existing CDK deployments and are used during the import process.

## Configuration

Each stack requires:
- `aws:region`: us-west-2
- `instanceSize`: large (dev), xlarge (stg), xlarge2 (prod)
- `cpuType`: ARM64
- `logLevel`: INFO
- `sshPubKey`: (Optional) SSH public key for EC2 access

AWS credentials are provided via ESC environment: `aws-creds/neo-demo-dev`

## Differences from CDK

### Simplified Resource Management
- **CDK**: Used custom Lambda functions for S3 bucket deployment
- **Pulumi**: Direct S3 bucket management with forceDestroy option

### Route Management
- **CDK**: Routes created as part of CloudFormation stack
- **Pulumi**: Routes managed as explicit resources

### IAM Policies
- **CDK**: Separate policy resources attached to roles
- **Pulumi**: Inline policies defined within role resource

## Rollback Plan

If migration issues occur:

1. **Before deleting CDK stacks**: Keep CDK stacks in CloudFormation as backup
2. **Pulumi state issues**: Use `pulumi stack export` to backup state before changes
3. **Resource conflicts**: Use `pulumi refresh` to sync state with AWS
4. **Complete rollback**: Delete Pulumi stacks and continue using CDK

## Post-Migration

### Optional: Clean Up CDK Resources

After successful migration and verification, you can optionally remove CDK stacks:

```bash
# This is OPTIONAL and should only be done after thorough testing
aws cloudformation delete-stack --region us-west-2 --stack-name EC2-Dev
aws cloudformation delete-stack --region us-west-2 --stack-name EC2-Stg
aws cloudformation delete-stack --region us-west-2 --stack-name EC2-Prod
```

**Note**: Deleting CDK stacks will NOT delete the actual AWS resources since they're now managed by Pulumi.

### Update Documentation

- Update runbooks to reference Pulumi commands instead of CDK
- Update CI/CD pipelines if applicable
- Train team members on Pulumi workflows

## Troubleshooting

### Import Failures

If import fails for a resource:
1. Verify the resource ID in `resource-mappings.ts` is correct
2. Check AWS credentials have proper permissions
3. Ensure the resource exists in AWS

### State Conflicts

If Pulumi shows unexpected changes:
1. Run `pulumi refresh` to sync state with AWS
2. Review the diff carefully
3. Use `pulumi stack export` to inspect state

### Route Issues

Routes may show as needing updates after import:
- This is expected due to differences in how CDK and Pulumi manage routes
- Review the changes - they should be minimal
- Approve the changes to reconcile

## Support

For issues during migration:
- Check Pulumi logs: `pulumi logs`
- Review AWS CloudFormation events
- Consult Pulumi documentation: https://www.pulumi.com/docs/
