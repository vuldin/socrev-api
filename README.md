## Configuration
This project needs a `.env` with the following variables:
```bash
DEFAULT_PORT=
CDN_API_URL=
CDN_KEY=
AUTH_AUDIENCE=
AUTH_NAME=
CMS_API_URL=
AWS_KEY=
AWS_SECRET=
AWS_REGION=
```

### At startup
`src/media.js` attempts to create a dynamodb table named `media` at each startup.
You will see a ResourceInUseException error printed to the console on subsequent starts once this table exists

### AWS setup
- install aws cli
- create new IAM user https://console.aws.amazon.com/iam
- add the following permissions:
  - AmazonAPIGatewayInvokeFullAccess
  - AmazonDynamoDBFullAccess
- add access key, secret key, and region (ie. `us-west-2`) to appropriate environment variable in .env
