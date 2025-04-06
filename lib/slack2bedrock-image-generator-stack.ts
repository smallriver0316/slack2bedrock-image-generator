import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'node:path';
import { HttpMethod } from 'aws-cdk-lib/aws-events';


export class Slack2BedrockImageGeneratorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') || 'dev';
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // Create an S3 bucket to store images
    const bucket = new s3.Bucket(this, `Bucket-${stage}`, {
      bucketName: `slack2bedrock-image-bucket-${stage}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // SQS queue for image generation requests
    const queue = new sqs.Queue(this, `Queue-${stage}`, {
      queueName: `slack2bedrock-image-request-queue-${stage}`,
      retentionPeriod: cdk.Duration.days(7),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function to handle image generation requests
    // IAM role
    const publisherLambdaRole = new iam.Role(this, `PublisherLambdaRole-${stage}`, {
      roleName: `slack2bedrock-image-generator-publisher-role-${stage}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        'publisher-lambda-policy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sqs:SendMessage',
              ],
              resources: [
                queue.queueArn,
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

    // lambda function
    const publisherLambda = new lambda.Function(this, `PublisherHandler-${stage}`, {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handle',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/publisher'), {
        exclude: ['Pipfile', 'Pipfile.lock', 'requirements.txt', '__pycache__'],
      }),
      role: publisherLambdaRole,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        SQS_QUEUE_URL: queue.queueUrl,
      },
    });

    publisherLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedMethods: [HttpMethod.GET, HttpMethod.POST],
        allowedOrigins: ['*'],
      },
    });

    // Cloudwatch log group for the publisher Lambda function
    new LogGroup(this, `PublisherLambdaLogGroup-${stage}`, {
      logGroupName: `/aws/lambda/${publisherLambda.functionName}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // IAM role for the subscriber Lambda function
    const subscriberLambdaRole = new iam.Role(this, `SubscriberLambdaRole-${stage}`, {
      roleName: `slack2bedrock-image-generator-subscriber-role-${stage}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        'subscriber-lambda-policy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
              ],
              resources: [
                '*',
              ],
            }),
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
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
              ],
              resources: [
                queue.queueArn,
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
      }
    });

    // Lambda function
    const subscriberLambda = new lambda.Function(this, `SubscriberHandler-${stage}`, {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handle',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/subscriber'), {
        exclude: ['Pipfile', 'Pipfile.lock', 'requirements.txt', '__pycache__'],
      }),
      role: subscriberLambdaRole,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUCKET_NAME: `slack2bedrock-image-bucket-${stage}`,
      },
    });

    // Cloudwatch log group for the subscriber Lambda function
    new LogGroup(this, `SuscriberLambdaLogGroup-${stage}`, {
      logGroupName: `/aws/lambda/${subscriberLambda.functionName}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    subscriberLambda.addEventSource(new cdk.aws_lambda_event_sources.SqsEventSource(queue));
  }
}
