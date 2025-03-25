import json


def handler(event, context):
    print(event)
    response_body = event.get('body', event)

    return {
        'statusCode': 200,
        'body': json.dumps(response_body)
    }
