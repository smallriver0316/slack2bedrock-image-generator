import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'node:path';
import { HttpMethod } from 'aws-cdk-lib/aws-events';


export class Slack2BedrockImageGeneratorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') || 'dev';
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    const bucket = new s3.Bucket(this, `Bucket-${stage}`, {
      bucketName: `slack2bedrock-image-bucket-${stage}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const role = new iam.Role(this, `Role-${stage}`, {
      roleName: `slack2bedrock-image-generator-role-${stage}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        's3-access': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:PutObject',
                's3:ListBucket',
              ],
              resources: [
                bucket.bucketArn,
                `${bucket.bucketArn}/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: [
                `arn:aws:logs:${region}:${accountId}:log-group:*:*`,
              ],
            }),
          ],
        }),
      },
    });

    const lambdaFunc = new lambda.Function(this, `Handler-${stage}`, {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      handler: 'index.handler',
      role,
      environment: {
        BUCKET_NAME: `slack2bedrock-image-bucket-${stage}`,
      },
    });

    lambdaFunc.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedMethods: [HttpMethod.GET, HttpMethod.POST],
        allowedOrigins: ['*'],
      },
    });

    new LogGroup(this, `LogGroup-${stage}`, {
      logGroupName: `/aws/lambda/${lambdaFunc.functionName}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
