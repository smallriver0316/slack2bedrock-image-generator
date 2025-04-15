import boto3
import json
import logging
import os
import re
from slack_bolt import App
from slack_bolt.adapter.aws_lambda import SlackRequestHandler


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

REGION = os.environ.get("AWS_REGION", "")
STAGE = os.environ.get("STAGE", "")
SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")

sqs = boto3.client("sqs", region_name=REGION)
ssm = boto3.client("ssm", region_name=REGION)

params = ssm.get_parameters_by_path(
    Path=f"/slack2bedrock-image-generator/{STAGE}/",
    Recursive=True,
    WithDecryption=True
)

for param in params["Parameters"]:
    if param["Name"].endswith("SLACK_BOT_TOKEN"):
        SLACK_BOT_TOKEN = param["Value"]
    if param["Name"].endswith("SLACK_SIGNING_SECRET"):
        SLACK_SIGNING_SECRET = param["Value"]

app = App(
    token=SLACK_BOT_TOKEN,
    signing_secret=SLACK_SIGNING_SECRET,
    process_before_response=True)


@app.event("app_mention")
def handle_app_mention_events(event, say):
    logger.debug(event)

    channel_id = event.get("channel", "")
    input_text = re.sub("<@.+>", "", event.get("text", "")).strip()

    sqs.send_message(
        QueueUrl=SQS_QUEUE_URL,
        MessageBody=json.dumps({
            "channel_id": channel_id,
            "input_text": input_text
        })
    )


def handler(event, context):
    logger.debug(event)
    slack_handler = SlackRequestHandler(app=app)
    return slack_handler.handle(event, context)
