#!/usr/bin/env node
import 'dotenv/config';
import { App } from 'aws-cdk-lib';
import { EC2Stack } from '../lib/ec2-stack';

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
};

const baseStackProps = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
  sshPubKey: process.env.SSH_PUB_KEY || ' ',
  cpuType: process.env.CPU_TYPE || 'ARM64',
};

// Development environment
new EC2Stack(app, 'EC2-Dev', {
  ...baseStackProps,
  instanceSize: 'LARGE',
  env,
  description: 'EC2 Instance - Development Environment',
});

// Staging environment
new EC2Stack(app, 'EC2-Stg', {
  ...baseStackProps,
  instanceSize: 'XLARGE',
  env,
  description: 'EC2 Instance - Staging Environment',
});

// Production environment
new EC2Stack(app, 'EC2-Prod', {
  ...baseStackProps,
  instanceSize: 'XLARGE2',
  env,
  description: 'EC2 Instance - Production Environment',
});

app.synth();
