# slack2bedrock-image-generator

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Setup

```bash
$ cdk --version
2.1005.0 (build be378de)
```

## How to deploy

### Create Slack app

At first, create slack account and the workspace beforehand.

* Access to [https://apps.slack.com](https://apps.slack.com).
* Create New App from scratch.
* Enter your app name and select your slack workspace.
* Move to the menu of OAuth & Permissions and create bot token.
  * Add "chat:write" and "files:write" as an OAuth Scope.
  * Then you can get Bot User OAuth Token.
* Install app to your workspace.

Copy the Signing Secret and Bot User OAuth Token for deployment of AWS services.

About the settings of this app, also refer to slack_manifest.yml here.

### Deploy services

Set the slack secret and token to config/slack_config.ts.

```ts
export const slackConfig = {
  SLACK_BOT_TOKEN: '<bot user oauth token>',
  SLACK_SIGNING_SECRET: '<signing secret>',
};
```

Then execute deployment.

```bash
# setting environment variables is necessary at every time
export AWS_PROFILE=<Your target profile>
export CDK_DEPLOY_ACCOUNT=<Your account id>
export CDK_DEPLOY_REGION=<Your target region>

# cdk bootstrap is necessary only at first
cdk synth
cdk bootstrap

# deploy stack
cdk deploy
# deploy with stage name(default is dev)
cdk deploy -c stage=<stage name>
```

### Set Event Subscriptions

* Copy the function URL of publihser lambda which you deployed in AWS console.
* Go back to the slack app setting page and move to the Event Subscriptions menu.
* Enable Events and set the URL as Request URL.
  * Then the subscription will be verified automatically.
* Select which bot events to subscribe from "Subscribe bot events".
  * Select "app_mention:read"
* Reinstall your app.
* Integrate your app on Slack desktop app.

Then you can communicate with your chat bot!
