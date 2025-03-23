#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Slack2BedrockImageGeneratorStack } from '../lib/slack2bedrock-image-generator-stack';

const app = new cdk.App();
new Slack2BedrockImageGeneratorStack(app, 'Slack2BedrockImageGeneratorStack', {
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
  },
});
