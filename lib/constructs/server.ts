import { RemovalPolicy } from 'aws-cdk-lib';
import {
  Vpc,
  SecurityGroup,
  Instance,
  InstanceType,
  InstanceClass,
  InstanceSize,
  MachineImage,
  AmazonLinuxCpuType,
} from 'aws-cdk-lib/aws-ec2';
import {
  Role,
  ServicePrincipal,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Source, BucketDeployment } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

interface ServerProps {
  vpc: Vpc;
  sshSecurityGroup: SecurityGroup;
  logLevel: string;
  sshPubKey: string;
  cpuType: string;
  instanceSize: string;
}

let cpuType: AmazonLinuxCpuType;
let instanceClass: InstanceClass;
let instanceSize: InstanceSize;

export class ServerResources extends Construct {
  public instance: Instance;

  constructor(scope: Construct, id: string, props: ServerProps) {
    super(scope, id);

    // Create an Asset Bucket for the Instance.  Assets in this bucket will be downloaded to the EC2 during deployment
    const assetBucket = new Bucket(this, 'assetBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      autoDeleteObjects: true,
    });

    // Deploy the local assets to the Asset Bucket during the CDK deployment
    new BucketDeployment(this, 'assetBucketDeployment', {
      sources: [Source.asset('lib/resources/server/assets')],
      destinationBucket: assetBucket,
      retainOnDelete: false,
      exclude: ['**/node_modules/**', '**/dist/**'],
      memoryLimit: 512,
    });

    // Create a role for the EC2 instance to assume.  This role will allow the instance to put log events to CloudWatch Logs
    const serverRole = new Role(this, 'serverEc2Role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      inlinePolicies: {
        ['RetentionPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['logs:PutRetentionPolicy'],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // Grant the EC2 role access to the bucket
    assetBucket.grantReadWrite(serverRole);


    // Create a Security Group for the EC2 instance.  This group will allow SSH access to the EC2 instance
    const ec2InstanceSecurityGroup = new SecurityGroup(
      this,
      'ec2InstanceSecurityGroup',
      { vpc: props.vpc, allowAllOutbound: true },
    );

    // Determine the correct CPUType and Instance Class based on the props passed in
    if (props.cpuType == 'ARM64') {
      cpuType = AmazonLinuxCpuType.ARM_64;
      instanceClass = InstanceClass.M7G;
    } else {
      cpuType = AmazonLinuxCpuType.X86_64;
      instanceClass = InstanceClass.M5;
    }

    // Determine the correct InstanceSize based on the props passed in
    switch (props.instanceSize) {
      case 'large':
        instanceSize = InstanceSize.LARGE;
        break;
      case 'xlarge':
        instanceSize = InstanceSize.XLARGE;
        break;
      case 'xlarge2':
        instanceSize = InstanceSize.XLARGE2;
        break;
      case 'xlarge4':
        instanceSize = InstanceSize.XLARGE4;
        break;
      default:
        instanceSize = InstanceSize.LARGE;
    }

    // Create the EC2 instance
    this.instance = new Instance(this, 'Instance', {
      vpc: props.vpc,
      instanceType: InstanceType.of(instanceClass, instanceSize),
      machineImage: MachineImage.latestAmazonLinux2023({
        cachedInContext: false,
        cpuType: cpuType,
      }),
      securityGroup: ec2InstanceSecurityGroup,
      role: serverRole,
    });

    // Add the SSH Security Group to the EC2 instance
    this.instance.addSecurityGroup(props.sshSecurityGroup);
  }
}
