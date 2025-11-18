import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { resourceMappings } from "./resource-mappings";

// Get configuration
const config = new pulumi.Config();
const instanceSize = config.require("instanceSize");
const cpuType = config.require("cpuType");
const logLevel = config.require("logLevel");
const sshPubKey = config.get("sshPubKey") || " ";

// Get current stack name to determine CDK stack name for imports
const stackName = pulumi.getStack();
const cdkStackName = stackName === "dev" ? "EC2-Dev" : stackName === "stg" ? "EC2-Stg" : "EC2-Prod";

// Get resource IDs for this stack
const resourceIds = resourceMappings[stackName];
if (!resourceIds) {
    throw new Error(`No resource mappings found for stack: ${stackName}`);
}

// Determine instance class and size based on configuration
const getInstanceType = (size: string, cpu: string): string => {
    const instanceClass = cpu === "ARM64" ? "m7g" : "m5";
    return `${instanceClass}.${size}`;
};

const instanceType = getInstanceType(instanceSize, cpuType);

// Get availability zones
const availabilityZones = aws.getAvailabilityZones({
    state: "available",
});

// Create VPC
const vpc = new aws.ec2.Vpc("VPC", {
    cidrBlock: "10.0.0.0/16",
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
        Name: `${cdkStackName}/VPC`,
    },
}, {
    import: resourceIds.vpc,
});

// Create Internet Gateway
const internetGateway = new aws.ec2.InternetGateway("IGW", {
    vpcId: vpc.id,
    tags: {
        Name: `${cdkStackName}/IGW`,
    },
}, {
    import: resourceIds.internetGateway,
});

// Create public subnets in 2 AZs
const publicSubnet1 = new aws.ec2.Subnet("ServerPublicSubnet1", {
    vpcId: vpc.id,
    cidrBlock: "10.0.0.0/24",
    availabilityZone: availabilityZones.then(azs => azs.names[0]),
    mapPublicIpOnLaunch: true,
    tags: {
        Name: `${cdkStackName}/VPC/ServerPublicSubnet1`,
    },
}, {
    import: resourceIds.publicSubnet1,
});

const publicSubnet2 = new aws.ec2.Subnet("ServerPublicSubnet2", {
    vpcId: vpc.id,
    cidrBlock: "10.0.1.0/24",
    availabilityZone: availabilityZones.then(azs => azs.names[1]),
    mapPublicIpOnLaunch: true,
    tags: {
        Name: `${cdkStackName}/VPC/ServerPublicSubnet2`,
    },
}, {
    import: resourceIds.publicSubnet2,
});

// Create route tables for public subnets
const publicRouteTable1 = new aws.ec2.RouteTable("ServerPublicSubnet1RouteTable", {
    vpcId: vpc.id,
    tags: {
        Name: `${cdkStackName}/VPC/ServerPublicSubnet1`,
    },
}, {
    import: resourceIds.routeTable1,
});

const publicRouteTable2 = new aws.ec2.RouteTable("ServerPublicSubnet2RouteTable", {
    vpcId: vpc.id,
    tags: {
        Name: `${cdkStackName}/VPC/ServerPublicSubnet2`,
    },
}, {
    import: resourceIds.routeTable2,
});

// Note: Routes already exist in the imported route tables from CDK
// They cannot be imported separately and will be managed by refreshing the route table state

// Associate route tables with subnets
const routeTableAssociation1 = new aws.ec2.RouteTableAssociation("ServerPublicSubnet1RouteTableAssociation", {
    subnetId: publicSubnet1.id,
    routeTableId: publicRouteTable1.id,
}, {
    import: resourceIds.routeTableAssociation1,
});

const routeTableAssociation2 = new aws.ec2.RouteTableAssociation("ServerPublicSubnet2RouteTableAssociation", {
    subnetId: publicSubnet2.id,
    routeTableId: publicRouteTable2.id,
}, {
    import: resourceIds.routeTableAssociation2,
});

// Create SSH Security Group
// Note: Rules are managed separately to avoid replacement during import
const sshSecurityGroup = new aws.ec2.SecurityGroup("SSHSecurityGroup", {
    vpcId: vpc.id,
    description: "Security Group for SSH",
    tags: {
        Name: `${cdkStackName}/VPC/SSHSecurityGroup`,
    },
}, {
    import: resourceIds.sshSecurityGroup,
});

// Create EC2 Instance Security Group  
// Note: Rules are managed separately to avoid replacement during import
const ec2SecurityGroup = new aws.ec2.SecurityGroup("ec2InstanceSecurityGroup", {
    vpcId: vpc.id,
    description: `${cdkStackName}/EC2/ec2InstanceSecurityGroup`,
    tags: {
        Name: `${cdkStackName}/EC2/ec2InstanceSecurityGroup`,
    },
}, {
    import: resourceIds.ec2SecurityGroup,
});

// Create IAM role for EC2 instance
const ec2Role = new aws.iam.Role("serverEc2Role", {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
                Service: "ec2.amazonaws.com",
            },
        }],
    }),
    managedPolicyArns: [
        "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
        "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
    ],
    inlinePolicies: [{
        name: "RetentionPolicy",
        policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Action: ["logs:PutRetentionPolicy"],
                Resource: ["*"],
            }],
        }),
    }],
    tags: {
        Name: `${cdkStackName}/EC2/serverEc2Role`,
    },
}, {
    import: resourceIds.ec2Role,
});

// Create instance profile for EC2 role
const instanceProfile = new aws.iam.InstanceProfile("InstanceProfile", {
    role: ec2Role.name,
    tags: {
        Name: `${cdkStackName}/EC2/InstanceProfile`,
    },
}, {
    import: resourceIds.instanceProfile,
});

// Create S3 bucket for assets
const assetBucket = new aws.s3.Bucket("assetBucket", {
    forceDestroy: true, // Equivalent to autoDeleteObjects in CDK
    tags: {
        Name: `${cdkStackName}/EC2/assetBucket`,
    },
}, {
    import: resourceIds.assetBucket,
});

// Note: The bucket policy is managed inline with the IAM role, not as a separate resource

// Create EC2 instance
// Note: Using the exact AMI from the existing instance to avoid replacement
// User data is omitted during import to prevent replacement
const ec2Instance = new aws.ec2.Instance("Instance", {
    instanceType: instanceType,
    ami: resourceIds.ec2InstanceAmi,
    subnetId: publicSubnet1.id,
    vpcSecurityGroupIds: [ec2SecurityGroup.id, sshSecurityGroup.id],
    iamInstanceProfile: instanceProfile.name,
    tags: {
        Name: `${cdkStackName}/EC2/Instance`,
    },
}, {
    import: resourceIds.ec2Instance,
    ignoreChanges: ["userData"], // Ignore user data changes to prevent replacement
});

// Export VPC and networking information
export const vpcId = vpc.id;
export const publicSubnet1Id = publicSubnet1.id;
export const publicSubnet2Id = publicSubnet2.id;
export const sshSecurityGroupId = sshSecurityGroup.id;
export const ec2SecurityGroupId = ec2SecurityGroup.id;
export const ec2RoleName = ec2Role.name;
export const instanceProfileName = instanceProfile.name;
export const assetBucketName = assetBucket.id;
export const instanceId = ec2Instance.id;
export const instancePublicIp = ec2Instance.publicIp;
export const instancePublicDns = ec2Instance.publicDns;
export const ssmCommand = pulumi.interpolate`aws ssm start-session --target ${ec2Instance.id}`;
export const sshCommand = pulumi.interpolate`ssh ec2-user@${ec2Instance.publicDns}`;
