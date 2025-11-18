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

// Create routes to Internet Gateway
// Note: Routes cannot be imported separately in Pulumi, they will be adopted on first update
const publicRoute1 = new aws.ec2.Route("ServerPublicSubnet1DefaultRoute", {
    routeTableId: publicRouteTable1.id,
    destinationCidrBlock: "0.0.0.0/0",
    gatewayId: internetGateway.id,
});

const publicRoute2 = new aws.ec2.Route("ServerPublicSubnet2DefaultRoute", {
    routeTableId: publicRouteTable2.id,
    destinationCidrBlock: "0.0.0.0/0",
    gatewayId: internetGateway.id,
});

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
const sshSecurityGroup = new aws.ec2.SecurityGroup("SSHSecurityGroup", {
    vpcId: vpc.id,
    description: "Security Group for SSH",
    ingress: [{
        protocol: "tcp",
        fromPort: 22,
        toPort: 22,
        cidrBlocks: ["0.0.0.0/0"],
        description: "Allow SSH inbound traffic on TCP port 22",
    }],
    egress: [{
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
        description: "Allow all outbound traffic",
    }],
    tags: {
        Name: `${cdkStackName}/VPC/SSHSecurityGroup`,
    },
}, {
    import: resourceIds.sshSecurityGroup,
});

// Create EC2 Instance Security Group
const ec2SecurityGroup = new aws.ec2.SecurityGroup("ec2InstanceSecurityGroup", {
    vpcId: vpc.id,
    description: "Security Group for EC2 Instance",
    egress: [{
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
        description: "Allow all outbound traffic",
    }],
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

// Get the latest Amazon Linux 2023 AMI
const ami = aws.ec2.getAmi({
    mostRecent: true,
    owners: ["amazon"],
    filters: [
        {
            name: "name",
            values: ["al2023-ami-*"],
        },
        {
            name: "architecture",
            values: [cpuType === "ARM64" ? "arm64" : "x86_64"],
        },
    ],
});

// Create user data script for EC2 instance
const userData = pulumi.all([assetBucket.id]).apply(([bucketName]) => {
    return `#!/bin/bash -xe
yum update -y
curl -sL https://dl.yarnpkg.com/rpm/yarn.repo | sudo tee /etc/yum.repos.d/yarn.repo
curl -sL https://rpm.nodesource.com/setup_18.x | sudo -E bash - 
yum install -y amazon-cloudwatch-agent nodejs python3-pip zip unzip docker yarn
sudo systemctl enable docker
sudo systemctl start docker
mkdir -p /home/ec2-user/sample
aws s3 cp s3://${bucketName}/sample /home/ec2-user/sample --recursive

# Configure CloudWatch Agent
cat > /tmp/amazon-cloudwatch-agent.json << 'EOF'
{
\t"agent": {
\t\t"run_as_user": "root"
\t},
\t"logs": {
\t\t"logs_collected": {
\t\t\t"files": {
\t\t\t\t"collect_list": [
\t\t\t\t\t{
\t\t\t\t\t\t"file_path": "/var/log/cloud-init-output.log",
\t\t\t\t\t\t"log_group_name": "/ec2/log/ec2-example/",
\t\t\t\t\t\t"log_stream_name": "{instance_id}-cloud-init-output",
\t\t\t\t\t\t"retention_in_days": 7
\t\t\t\t\t},
\t\t\t\t\t{
\t\t\t\t\t\t"file_path": "/var/log/cloud-init.log",
\t\t\t\t\t\t"log_group_name": "/ec2/log/ec2-example/",
\t\t\t\t\t\t"log_stream_name": "{instance_id}-cloud-init",
\t\t\t\t\t\t"retention_in_days": 7
\t\t\t\t\t}
\t\t\t\t]
\t\t\t}
\t\t}
\t}
}
EOF

# Create config.json
cat > /etc/config.json << EOF
{
  "STACK_ID": "${cdkStackName}"
}
EOF

# Create config.sh
cat > /etc/config.sh << 'EOF'
#!/bin/bash -xe
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/tmp/amazon-cloudwatch-agent.json
EOF

chmod +x /etc/config.sh
/etc/config.sh

# Add SSH public key
echo "${sshPubKey}" >> /home/ec2-user/.ssh/authorized_keys
`;
});

// Create EC2 instance
const ec2Instance = new aws.ec2.Instance("Instance", {
    instanceType: instanceType,
    ami: ami.then(a => a.id),
    subnetId: publicSubnet1.id,
    vpcSecurityGroupIds: [ec2SecurityGroup.id, sshSecurityGroup.id],
    iamInstanceProfile: instanceProfile.name,
    userData: userData,
    tags: {
        Name: `${cdkStackName}/EC2/Instance`,
    },
}, {
    import: resourceIds.ec2Instance,
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
