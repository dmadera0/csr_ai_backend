# CSR AI - Customer Service Chatbot Backend

AWS Lambda-based customer service chatbot powered by Claude AI via Amazon Bedrock, with persistent conversation storage in DynamoDB.

## Overview

This project implements three independent per-business Lambda functions for customer service chatbots:

1. **Demosite** - Generic e-commerce demo site
2. **Apex Builders** - Construction services company
3. **Serenity Spa** - Wellness spa

Each business has:
- Isolated DynamoDB conversation storage
- Isolated S3 knowledge base documents
- Shared Bedrock Knowledge Base ID (same KB, different scoped documents)
- Independent API Gateway endpoint

## Architecture

```
API Gateway
    ├── POST /demosite → demosite-chat-function
    ├── POST /apex-builders → apex-builders-chat-function
    └── POST /serenity-spa → serenity-spa-chat-function
            ↓
    AWS Lambda (Node.js 20.x)
            ↓
    ┌───────┴────────┐
    ↓                ↓
Bedrock         DynamoDB
(Claude)        Conversations
    ↓                ↓
Knowledge      Session History
Base (KB)      + Analytics
```

## Project Structure

```
csr-ai-backend/
├── lambda/
│   ├── demosite/
│   │   ├── index.js           # Lambda handler
│   │   ├── package.json       # Dependencies
│   │   ├── .env.example       # Environment template
│   │   └── node_modules/      # AWS SDK packages
│   ├── apex-builders/
│   │   ├── index.js
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── node_modules/
│   └── serenity-spa/
│       ├── index.js
│       ├── package.json
│       ├── .env.example
│       └── node_modules/
├── .github/
│   └── workflows/
│       └── deploy-lambda.yml  # CI/CD pipeline
├── package.json               # Root package (convenience scripts)
└── README.md                  # This file
```

## Quick Start

### 1. Install Dependencies

```bash
# Install all lambda dependencies
npm run install-lambdas

# Or manually:
cd lambda/demosite && npm install
cd ../apex-builders && npm install
cd ../serenity-spa && npm install
```

### 2. Configure Environment Variables

Each Lambda requires environment variables set in AWS Lambda console:

**Demosite:**
```
DYNAMODB_TABLE=demosite-conversations
KB_ID=AB2OOZFU3J
BUSINESS_NAME=demosite
AWS_REGION=us-east-1
```

**Apex Builders:**
```
DYNAMODB_TABLE=apex-builders-conversations
KB_ID=AB2OOZFU3J
BUSINESS_NAME=apex-builders
AWS_REGION=us-east-1
```

**Serenity Spa:**
```
DYNAMODB_TABLE=serenity-spa-conversations
KB_ID=AB2OOZFU3J
BUSINESS_NAME=serenity-spa
AWS_REGION=us-east-1
```

### 3. Deploy to AWS

```bash
# Manual deployment (zip and upload to Lambda):
cd lambda/demosite
zip -r function.zip index.js node_modules/
aws lambda update-function-code --function-name demosite-chat-function --zip-file fileb://function.zip

# Or use GitHub Actions (automatic on push):
git push origin main  # Triggers .github/workflows/deploy-lambda.yml
```

## API Reference

### Request Format

**Endpoint:** `POST /[business-name]`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "sessionId": "session-abc123",    // Required: non-empty string
  "userId": "user-john",             // Optional: defaults to "anonymous"
  "message": "What is your return policy?"  // Required: 3-2000 chars
}
```

### Success Response (HTTP 200)

```json
{
  "response": "Returns are free within 30 days of purchase...",
  "sessionId": "session-abc123",
  "timestamp": 1715088000000
}
```

### Error Responses

**HTTP 400 - Validation Error:**
```json
{
  "error": "Validation error",
  "details": "message must be at least 3 characters long"
}
```

**HTTP 400 - Invalid JSON:**
```json
{
  "error": "Invalid JSON",
  "details": "Request body must be valid JSON"
}
```

**HTTP 500 - Server Error:**
```json
{
  "error": "Internal server error"
}
```

## Example Requests

### Using cURL

```bash
# Demosite
curl -X POST https://api.example.com/demosite \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess-123",
    "userId": "customer-001",
    "message": "Do you have this item in size L?"
  }'

# Apex Builders
curl -X POST https://api.example.com/apex-builders \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess-456",
    "message": "When can you provide an estimate for my kitchen renovation?"
  }'

# Serenity Spa
curl -X POST https://api.example.com/serenity-spa \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess-789",
    "message": "What are your membership options?"
  }'
```

### Using Node.js

```javascript
const axios = require('axios');

async function chat(business, sessionId, message, userId = 'anonymous') {
  try {
    const response = await axios.post(
      `https://api.example.com/${business}`,
      {
        sessionId,
        userId,
        message
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    console.log('Response:', response.data.response);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Usage
chat('demosite', 'session-001', 'What is your return policy?');
```

## Lambda Function Details

### Handler Function: `index.handler`

Each Lambda function exports a handler that:

1. **Parses** API Gateway proxy event
2. **Validates** required fields (sessionId, message)
3. **Calls** AWS Bedrock with Claude Sonnet 4
4. **Stores** conversation in DynamoDB
5. **Returns** formatted response with CORS headers

### Validation Rules

| Field | Required | Type | Min/Max | Validation |
|-------|----------|------|---------|-----------|
| sessionId | Yes | String | 1+ | Non-empty |
| userId | No | String | - | Defaults to "anonymous" |
| message | Yes | String | 3-2000 | Trimmed length check |

### Error Handling

- **Parse Errors:** Returns 400 with "Invalid JSON"
- **Validation Errors:** Returns 400 with details
- **Bedrock Errors:** Logged and returns 500
- **DynamoDB Errors:** Logged and returns 500
- **Unexpected Errors:** Returns 500 "Internal server error"

### Logging

All functions log to CloudWatch with prefix `[business-name]`:

```
[demosite] Incoming request: {...}
[demosite] Calling Bedrock with KB: AB2OOZFU3J
[demosite] Bedrock response received (324 chars)
[demosite] Storing conversation for session: session-abc123
[demosite] Conversation stored successfully
[demosite] Request completed in 1234ms
```

## DynamoDB Schema

### Table Name
- `demosite-conversations`
- `apex-builders-conversations`
- `serenity-spa-conversations`

### Item Structure

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| sessionId | String | Partition Key | Chat session identifier |
| timestamp | Number | Sort Key | Unix timestamp (seconds) |
| userId | String | - | User identifier or "anonymous" |
| message | String | - | Customer's message |
| response | String | - | Claude's response |
| businessName | String | - | Business identifier |
| createdAt | String | - | ISO 8601 timestamp |

### Example Item

```json
{
  "sessionId": "session-abc123",
  "timestamp": 1715088000,
  "userId": "user-john",
  "message": "What is your return policy?",
  "response": "Returns are free within 30 days of purchase...",
  "businessName": "demosite",
  "createdAt": "2024-05-07T12:00:00.000Z"
}
```

## Bedrock Configuration

### Model
- **ID:** `anthropic.claude-sonnet-4-20250514`
- **Max Tokens:** 1024
- **Temperature:** 0.7

### Knowledge Base
- **ID:** `AB2OOZFU3J`
- **Scope:** Business-specific documents via S3 buckets
  - `demosite-documents`
  - `apex-builders-documents`
  - `serenity-spa-documents`

## CORS Support

All responses include CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Handles preflight OPTIONS requests automatically.

## AWS IAM Permissions

Create an IAM role with these permissions for each Lambda:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-20250514"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/*-conversations"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:*:*"
    }
  ]
}
```

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/deploy-lambda.yml`) automatically:

1. Runs on push to `main` branch
2. Installs dependencies
3. Zips each Lambda function
4. Uploads to AWS Lambda via AWS CLI
5. Reports deployment status

### Environment Variables (GitHub Secrets)

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-1
```

## Troubleshooting

### Lambda Timeout
- **Problem:** Bedrock calls timeout after 30 seconds
- **Solution:** Increase Lambda timeout to 60 seconds in AWS console

### DynamoDB Throttling
- **Problem:** "ProvisionedThroughputExceededException"
- **Solution:** Increase DynamoDB write capacity units (WCU)

### Bedrock Access Denied
- **Problem:** "User is not authorized to perform: bedrock:InvokeModel"
- **Solution:** Check Lambda IAM role has Bedrock permissions

### CloudWatch Logs Empty
- **Problem:** No logs appearing in CloudWatch
- **Solution:** Check Lambda execution role has CloudWatch Logs permissions

### Invalid JSON in Request
- **Problem:** Returns 400 "Invalid JSON"
- **Solution:** Validate request body is valid JSON, check Content-Type header

### Missing Required Fields
- **Problem:** Returns 400 "Validation error"
- **Solution:** Ensure sessionId and message are provided and non-empty

## Monitoring & Analytics

### CloudWatch Metrics

Monitor these metrics per Lambda:

- **Invocations:** Total requests
- **Duration:** Average response time (target: < 2s)
- **Errors:** Failed requests
- **Throttles:** Rate limiting hits

### DynamoDB Metrics

- **ConsumedWriteCapacityUnits:** Track write usage
- **UserErrors:** Client-side errors
- **SystemErrors:** Server-side errors

### Custom Metrics

Each Lambda logs:
- Request timestamp
- Response latency (ms)
- Business name
- Session ID

Query example:
```
fields @timestamp, @duration, businessName, sessionId
| filter @duration > 1000
| stats avg(@duration) by businessName
```

## Performance Optimization

### Current Performance
- **Cold Start:** ~500ms (first request after deploy)
- **Warm Response:** ~200-400ms (subsequent requests)
- **Bedrock Latency:** ~150-300ms (network dependent)

### Optimization Tips

1. **Keep Lambda Warm:** Configure scheduled EventBridge rule
2. **Increase Memory:** 512 MB → 1024 MB reduces execution time
3. **Optimize Prompt:** Shorter prompts reduce Bedrock latency
4. **Batch Responses:** If applicable, batch multiple messages

## Security Considerations

1. **API Key Protection:** Implement API Gateway API Keys if public
2. **Rate Limiting:** Enable throttling in API Gateway
3. **Input Validation:** All inputs validated (2000 char limit on message)
4. **Error Messages:** No sensitive info in error responses
5. **CORS:** Restrict to known domains in production (replace `*`)
6. **Logging:** Avoid logging sensitive customer data

## Development

### Local Testing (requires SAM CLI)

```bash
# Install SAM CLI
pip install aws-sam-cli

# Build and run locally
sam local start-api

# In another terminal
curl -X POST http://localhost:3000/demosite \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-123",
    "message": "Hello, can you help me?"
  }'
```

### Testing Individual Functions

```bash
cd lambda/demosite

# View environment template
cat .env.example

# Create .env for local testing (AWS credentials required)
cp .env.example .env
nano .env  # Edit with real values

# Test locally with Node
node -e "
const handler = require('./index.js').handler;
handler({
  httpMethod: 'POST',
  body: JSON.stringify({
    sessionId: 'test-123',
    userId: 'test-user',
    message: 'Hello'
  })
}).then(result => console.log(JSON.stringify(result, null, 2)));
"
```

## Deployment Checklist

- [ ] AWS account with Lambda, DynamoDB, Bedrock, API Gateway access
- [ ] Create DynamoDB tables (one per business)
- [ ] Create S3 buckets for knowledge base documents
- [ ] Create Bedrock Knowledge Base with ID: AB2OOZFU3J
- [ ] Create IAM roles with required permissions
- [ ] Create API Gateway with three POST routes
- [ ] Deploy three Lambda functions
- [ ] Set environment variables in Lambda console
- [ ] Test each endpoint with sample request
- [ ] Configure GitHub Actions secrets (AWS credentials)
- [ ] Monitor CloudWatch logs for errors
- [ ] Set up CloudWatch alarms for failures

## Support & Troubleshooting

See detailed troubleshooting guide in each function's README:
- `lambda/demosite/README.md`
- `lambda/apex-builders/README.md`
- `lambda/serenity-spa/README.md`

## License

MIT

## Contributing

1. Test changes locally
2. Ensure all three Lambda functions work
3. Update documentation
4. Create pull request
5. GitHub Actions will auto-deploy on merge to main
