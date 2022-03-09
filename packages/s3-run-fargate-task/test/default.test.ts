import {
  App, Stack,
  aws_s3 as s3,
  assertions,
} from 'aws-cdk-lib'
import { S3RunFargateTask } from '../src'


describe('synthesizes successfully with all parameters', () => {
  // Create CDK app, stack and resources for the tests
  const app = new App()
  const stack = new Stack(app, 'demo-stack')
  const bucket = new s3.Bucket(stack, 'Bucket', {
    bucketName: 's3-fargate-bucket',
  })

  const ruleName = 'cdk-run-fargate-rule'
  const ruleDescription = 'rule to run fargate task'
  const clusterName = 'FargateCluster'
  const eventBusName = 'bus123'
  const subnetIds = ['subnet-0fe666666', 'subnet-0ef015444449']
  const securityGroups = ['sg-0f4ffff00']
  const taskDefinitionArn = 'arn:aws:ecs:us-east-1:01234444:task-definition/FargateTask:9'
  const containerName = 'app123'
  let template: assertions.Template

  new S3RunFargateTask(stack, 'S3RunFargateTask', {
    bucket,
    ruleName,
    ruleDescription,
    eventBusName,
    clusterName,
    taskDefinitionArn,
    containerName,
    subnetIds,
    assignPublicIp: true,
    securityGroups,
  })
  template = assertions.Template.fromStack(stack)

  test('enable EventBridge notifications on bucket', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      NotificationConfiguration: {
        EventBridgeConfiguration: {
          EventBridgeEnabled: true,
        },
      },
    })
  })

  test('correct rule basic configuration', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      Description: ruleDescription,
      EventBusName: eventBusName,
      EventPattern: {
        'source': [
          'aws.s3',
        ],
        'detail-type': [
          'Object Created',
        ],
        'detail': {
          bucket: {
            name: [
              {
                Ref: 'Bucket83908E77',
              },
            ],
          },
        },
      },
      Name: ruleName,
      State: 'ENABLED',
    })
  })

  test('correct arn in the rule target', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      Targets: [
        assertions.Match.objectLike(
          {
            Arn: {
              'Fn::Join': [
                '',
                [
                  'arn:aws:ecs:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  `:cluster/${clusterName}`,
                ],
              ],
            },
          }),
      ],
    })
  })

  test('correct dlq config in the rule target', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      Targets: [
        assertions.Match.objectLike({
          RetryPolicy: {
            MaximumRetryAttempts: 3,
          },
          DeadLetterConfig: {
            Arn: {
              'Fn::GetAtt': [
                'S3RunFargateTaskDLQ7751B32B',
                'Arn',
              ],
            },
          },
        }),
      ],
    })
  })

  test('correct ecs parameters in the rule target', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      Targets: [
        assertions.Match.objectLike({
          EcsParameters: {
            LaunchType: 'FARGATE',
            NetworkConfiguration: {
              AwsVpcConfiguration: {
                AssignPublicIp: 'ENABLED',
                SecurityGroups: securityGroups,
                Subnets: subnetIds,
              },
            },
            TaskCount: 1,
            TaskDefinitionArn: taskDefinitionArn,
          },
        }),
      ],
    })
  })

  test('correct input transformer in the rule target', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      Targets: [
        assertions.Match.objectLike({
          InputTransformer: {
            InputPathsMap: {
              bucket: '$.detail.bucket.name',
              s3Key: '$.detail.object.key',
            },
            InputTemplate: '{\n              \"containerOverrides\": [\n                {\n                  \"name\":\"app123\",\n                  \"environment\":[\n                    {\"name\":\"BUCKET\",\"value\":<bucket>},\n                    {\"name\":\"KEY\",\"value\":<s3Key>}\n                  ]\n                }\n              ]\n            }',
          },
        }),
      ],
    })
  })

})

describe('synthesizes successfully with minimum parameters', () => {
  // Create CDK app, stack and resources for the tests
  const app = new App()
  const stack = new Stack(app, 'demo-stack')
  const bucket = new s3.Bucket(stack, 'Bucket', {
    bucketName: 's3-fargate-bucket',
  })

  const ruleName = 'cdk-run-fargate-rule'
  const clusterName = 'FargateCluster'
  const subnetIds = ['subnet-0fe666666', 'subnet-0ef015444449']
  const securityGroups = ['sg-0f4ffff00']
  const taskDefinitionArn = 'arn:aws:ecs:us-east-1:01234444:task-definition/FargateTask:9'
  let template: assertions.Template

  new S3RunFargateTask(stack, 'S3RunFargateTask', {
    bucket,
    ruleName,
    clusterName,
    taskDefinitionArn,
    containerName: 'app123',
    subnetIds,
    securityGroups,
  })
  template = assertions.Template.fromStack(stack)

  test('assign public ip disabled in the rule target', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      Targets: [
        assertions.Match.objectLike({
          EcsParameters: {
            NetworkConfiguration: {
              AwsVpcConfiguration: {
                AssignPublicIp: 'DISABLED',
              },
            },
          },
        }),
      ],
    })
  })

  test('no event bus name or rule description ', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      Description: assertions.Match.absent(),
      EventBusName: assertions.Match.absent(),
    })
  })

})