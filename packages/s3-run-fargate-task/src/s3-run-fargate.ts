import {
  Stack,
  aws_s3 as s3,
  aws_events as events,
  aws_iam as iam,
  aws_sqs as sqs,
  aws_events,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

/**
 * Properties for S3RunFargate Construct
 */
export interface S3RunFargateTaskProps {
  /**
   * S3 bucket
   */
  readonly bucket: s3.Bucket,
  /**
   * The name or ARN of the event bus associated with the rule
   * If you omitted, the default event bus is used
   *
   * @default default
   */
  readonly eventBusName?: string,
  /**
   * The name of the rule
   */
  readonly ruleName: string,
  /**
   * Rule description
   *
   * @default '''
   */
  readonly ruleDescription?: string,
  /**
   * ECS cluster name
   */
  readonly clusterName: string,
  /**
   * Fargate task ARN
   */
  readonly taskDefinitionArn: string,
  /**
   * Container name
   */
  readonly containerName: string,
  /**
   * Subnets IDs for Fargate task
   */
  readonly subnetIds: string[],
  /**
   * Specify if assign public IP address to task
   * If running in public subnet, this should be true
   *
   * @default false
   */
  readonly assignPublicIp?: boolean,
  /**
   * Security groups for Fargate task
   */
  readonly securityGroups: string[]
}

export class S3RunFargateTask extends Construct {
  public readonly dlq: sqs.Queue
  public readonly rule: aws_events.CfnRule

  /**
   * @summary Construct to run a Fargate task when files have been added to S3
   * @param {cdk.App} scope - represents the scope for all the resources.
   * @param {string} id - this is a a scope-unique id.
   * @param {S3RunFargateTaskProps} props - user provided props for the construct.
   * @since 0.8.0
   * @access private
  */
  constructor(scope: Construct, id: string, props: S3RunFargateTaskProps) {
    super(scope, id)

    const account = Stack.of(this).account
    const region = Stack.of(this).region

    // Use Bucket Cfn class to enable EventBridge notifications
    const cfnBucket = props.bucket.node.defaultChild as s3.CfnBucket
    cfnBucket.addPropertyOverride('NotificationConfiguration.EventBridgeConfiguration.EventBridgeEnabled', true)

    // DeadLetter queue
    const dlq = new sqs.Queue(this, 'DLQ', {
      queueName: `${props.ruleName}-DLQ`,
      encryption: sqs.QueueEncryption.KMS_MANAGED,
    })
    this.dlq = dlq

    // EventBridge rule role
    const ruleRole = new iam.Role(this, 'RuleRole', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
    })
    ruleRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ecs:RunTask'],
      resources: [props.taskDefinitionArn],
    }))
    ruleRole.addToPolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: ['*'],
      conditions: {
        StringLike: {
          'iam:PassedToService': 'ecs-tasks.amazonaws.com',
        },
      },
    }))

    // EventBridge Rule
    const s3Rule = new events.CfnRule(this, 'RunFargateRule', {
      eventBusName: props.eventBusName,
      name: props.ruleName,
      description: props.ruleDescription,
      eventPattern: {
        'source': ['aws.s3'],
        'detail-type': ['Object Created'], // weird bug in the cdk is not converting detailType
        'detail': {
          bucket: {
            name: [props.bucket.bucketName],
          },
        },
      },
      state: 'ENABLED',
      targets: [
        {
          arn: `arn:aws:ecs:${region}:${account}:cluster/${props.clusterName}`,
          id: 'Id1',
          roleArn: ruleRole.roleArn,
          ecsParameters: {
            taskDefinitionArn: props.taskDefinitionArn,
            launchType: 'FARGATE',
            networkConfiguration: {
              awsVpcConfiguration: {
                subnets: props.subnetIds,
                assignPublicIp: props.assignPublicIp ? 'ENABLED' : 'DISABLED',
                securityGroups: props.securityGroups,
              },
            },
            taskCount: 1,
          },
          inputTransformer: {
            inputPathsMap: {
              bucket: '$.detail.bucket.name',
              s3Key: '$.detail.object.key',
            },
            inputTemplate: `{
              \"containerOverrides\": [
                {
                  \"name\":\"${props.containerName}\",
                  \"environment\":[
                    {\"name\":\"BUCKET\",\"value\":<bucket>},
                    {\"name\":\"KEY\",\"value\":<s3Key>}
                  ]
                }
              ]
            }`,
          },
          retryPolicy: {
            maximumRetryAttempts: 3,
          },
          deadLetterConfig: {
            arn: dlq.queueArn,
          },
        },
      ],
    })
    this.rule = s3Rule

  }
}
