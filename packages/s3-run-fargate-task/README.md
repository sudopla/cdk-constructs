# @sudocdkconstructs/s3-run-fargate-task

It's a very common AWS pattern to run a Fargate task when a file is uploaded to a S3 bucket. Usually developers create a Lambda function that is connected to S3 event notifications and starts the Fargate task. 
This construct uses a little different approach. It enables [S3 EventBridge notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html) in the bucket and creates a rule that runs the Fargate task. It passes the bucket name and object key to the container as an environment variables. Notice that it does not required a Lambda function.   

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
const bucket = new cdk.aws_s3.Bucket(this, 'Bucket', {
    bucketName: 's3-fargate-bucket'
})

new S3RunFargateTask(this, 'S3RunFargateTask', {
    bucket,
    ruleName: 'cdk-run-fargate-rule',
    clusterName: 'FargateCluster',
    ruleDescription: 's3 event runs fargate task',
    taskDefinitionArn: 'arn:aws:ecs:us-east-1:002020202:task-definition/FargateTask:9',
    containerName: 'processContainer',
    subnetIds: ['subnet-0001', 'subnet-00002'],
    securityGroups: ['sg-00001']
})
```

The bucket name will be in the container environment variable `BUCKET` and the object key in the `KEY` variable.
