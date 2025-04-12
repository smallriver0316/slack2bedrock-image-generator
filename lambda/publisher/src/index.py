import boto3
import json
import logging
import os
import re
from slack_bolt import App
from slack_bolt.adapter.aws_lambda import SlackRequestHandler


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

sqs = boto3.client("sqs")
ssm = boto3.client("ssm")


def get_slack_token(key: str):
    return ssm.get_parameter(
        Name=key,
        WithDecryption=True
    )["Parameter"]["Value"]


SLACK_BOT_TOKEN = get_slack_token(
    os.environ.get("SLACK_BOT_TOKEN_SSM_KEY", ""))
SLACK_SIGNING_SECRET = get_slack_token(
    os.environ.get("SLACK_SIGNING_SECRET_SSM_KEY", ""))

app = App(
    token=SLACK_BOT_TOKEN,
    signing_secret=SLACK_SIGNING_SECRET,
    process_before_response=True)


@app.event("app_mention")
def handle_app_mention_events(event, say):
    logger.info(event)
    say("What's up?")

    channel_id = event.get("channel", "")
    input_text = re.sub("<@.+>", "", event.get("text", "")).strip()

    sqs.send_message(
        QueueUrl=os.environ.get("SQS_QUEUE_URL"),
        MessageBody=json.dumps({
            "channel_id": channel_id,
            "input_text": input_text
        })
    )


def handler(event, context):
    logger.info(event)
    slack_handler = SlackRequestHandler(app=app)
    return slack_handler.handle(event, context)
