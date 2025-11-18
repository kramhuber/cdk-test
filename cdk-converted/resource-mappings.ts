// Resource ID mappings from CDK stacks to Pulumi imports
// These are the physical resource IDs from the existing CDK deployments

export interface ResourceMapping {
    vpc: string;
    internetGateway: string;
    publicSubnet1: string;
    publicSubnet2: string;
    routeTable1: string;
    routeTable2: string;
    routeTableAssociation1: string;
    routeTableAssociation2: string;
    sshSecurityGroup: string;
    ec2SecurityGroup: string;
    ec2Role: string;
    instanceProfile: string;
    assetBucket: string;
    ec2Instance: string;
}

export const resourceMappings: Record<string, ResourceMapping> = {
    dev: {
        vpc: "vpc-00670458d2ea5bd69",
        internetGateway: "igw-07ca318fd167fc1c7",
        publicSubnet1: "subnet-0cff59825efa397f7",
        publicSubnet2: "subnet-051a9fcd8fa3e1516",
        routeTable1: "rtb-04da744c73ff9a1a2",
        routeTable2: "rtb-09ebd0517ff96419e",
        routeTableAssociation1: "subnet-0cff59825efa397f7/rtb-04da744c73ff9a1a2",
        routeTableAssociation2: "subnet-051a9fcd8fa3e1516/rtb-09ebd0517ff96419e",
        sshSecurityGroup: "sg-05c41c122aedbbe72",
        ec2SecurityGroup: "sg-0091589061fcd0d52",
        ec2Role: "EC2-Dev-EC2serverEc2Role6775A3D4-IOYXJ5aBhapD",
        instanceProfile: "EC2-Dev-EC2InstanceInstanceProfile2CAA3051-QnRsJpERzkJc",
        assetBucket: "ec2-dev-ec2assetbucketc584b4ab-wdszsco2nzum",
        ec2Instance: "i-084b07ea685e39d1d",
    },
    stg: {
        vpc: "vpc-00cae33fe84d6baa2",
        internetGateway: "igw-024c88301d939f08d",
        publicSubnet1: "subnet-01997b2e2184c9fad",
        publicSubnet2: "subnet-06a48139e1f05ce35",
        routeTable1: "rtb-04e7d123eb2de4b6d",
        routeTable2: "rtb-0ae5b427533545225",
        routeTableAssociation1: "subnet-01997b2e2184c9fad/rtb-04e7d123eb2de4b6d",
        routeTableAssociation2: "subnet-06a48139e1f05ce35/rtb-0ae5b427533545225",
        sshSecurityGroup: "sg-02b0bb5ee7969a4db",
        ec2SecurityGroup: "sg-0eb8e09255774711c",
        ec2Role: "EC2-Stg-EC2serverEc2Role6775A3D4-oiMp0pW2CgA2",
        instanceProfile: "EC2-Stg-EC2InstanceInstanceProfile2CAA3051-bZA5FlPL6Zic",
        assetBucket: "ec2-stg-ec2assetbucketc584b4ab-ixd2lcpojxkq",
        ec2Instance: "i-071acd3aea4369f21",
    },
    prod: {
        vpc: "vpc-02c9ccffda204bf71",
        internetGateway: "igw-0e067e07d15ed8807",
        publicSubnet1: "subnet-029297dbc45e7e0ea",
        publicSubnet2: "subnet-0015005d09a73a959",
        routeTable1: "rtb-0f72278af06c13275",
        routeTable2: "rtb-057494342af7aa014",
        routeTableAssociation1: "subnet-029297dbc45e7e0ea/rtb-0f72278af06c13275",
        routeTableAssociation2: "subnet-0015005d09a73a959/rtb-057494342af7aa014",
        sshSecurityGroup: "sg-02402722b63caa77a",
        ec2SecurityGroup: "sg-0b6f8694e4d1e54cb",
        ec2Role: "EC2-Prod-EC2serverEc2Role6775A3D4-VxbgrSLLUWZn",
        instanceProfile: "EC2-Prod-EC2InstanceInstanceProfile2CAA3051-pZIDwCyGFdJX",
        assetBucket: "ec2-prod-ec2assetbucketc584b4ab-kiw0zmzgmxfr",
        ec2Instance: "i-0ec50891e8e8222ec",
    },
};
