# @sudocdkconstructs/s3-run-fargate-task

It's a very common AWS pattern to run a Fargate task when a file is uploaded to an S3 bucket. Usually users connect a Lambda function to S3 event notifications, and the function starts the Fargate task. This construct uses a little different approach. It enables [S3 EventBridge notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html) in the bucket and creates a rule that runs the Fargate task. It passes the bucket name and object key to the container as an environment variables. Notice that it does not need to use a Lambda for this.  

## Install
TypeScript/JavaScript:

```bash
npm i @sudocdkconstructs/s3-run-fargate-task 
```

Python:

```bash
pip install sudocdkconstructs.s3-run-fargate-task 
```

## How to use

```typescript

```
