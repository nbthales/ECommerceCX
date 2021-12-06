import * as lambda from "@aws-cdk/aws-lambda"
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs"
import * as cdk from "@aws-cdk/core"
import * as dynamodb from "@aws-cdk/aws-dynamodb"
import * as sns from "@aws-cdk/aws-sns"
import * as subs from "@aws-cdk/aws-sns-subscriptions"
import * as iam from "@aws-cdk/aws-iam"
import * as sqs from "@aws-cdk/aws-sqs"
import * as lambdaEventSource from "@aws-cdk/aws-lambda-event-sources"
import * as logs from '@aws-cdk/aws-logs'
import * as cw from '@aws-cdk/aws-cloudwatch'

interface OrdersApplicationStackProps extends cdk.StackProps {
    productsDdb: dynamodb.Table,
    eventsDdb: dynamodb.Table
}

export class OrdersApplicationStack extends cdk.Stack {
    readonly ordersHandler: lambdaNodeJS.NodejsFunction
    readonly orderEventsFetchHandler: lambdaNodeJS.NodejsFunction

    constructor(scope: cdk.Construct, id: string, props: OrdersApplicationStackProps) {
        super(scope, id, props)

        const ordersDdb = new dynamodb.Table(this, "OrdersDdb", {
            tableName: "orders",
            partitionKey: {
                name: "pk",
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: "sk",
                type: dynamodb.AttributeType.STRING
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })
        //Metric
        const writeThrotlleEventsMetric = ordersDdb.metric('WriteThrottleEvents', {
            period: cdk.Duration.minutes(2),
            statistic: 'SampleCount',
            unit: cw.Unit.COUNT
        })
        //Alarm
        writeThrotlleEventsMetric.createAlarm(this, "WriteThrottleEventsAlarm", {
            alarmName: 'WriteThrottleEvents',
            alarmDescription: 'Write throttled events alarm in orders DDB',
            actionsEnabled: false,
            evaluationPeriods: 1,
            threshold: 25,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING
        })

        /*
        const readScale = ordersDdb.autoScaleReadCapacity({
           maxCapacity: 2,
           minCapacity: 1
        })
        readScale.scaleOnUtilization({
           targetUtilizationPercent: 80,
           scaleInCooldown: cdk.Duration.seconds(120),
           scaleOutCooldown: cdk.Duration.seconds(60)        
            scaleOutCooldown: cdk.Duration.seconds(60)
           scaleOutCooldown: cdk.Duration.seconds(60)        
            scaleOutCooldown: cdk.Duration.seconds(60)
           scaleOutCooldown: cdk.Duration.seconds(60)        
        })

        const writeScale = ordersDdb.autoScaleWriteCapacity({
           maxCapacity: 4,
           minCapacity: 1
        })
        writeScale.scaleOnUtilization({
           targetUtilizationPercent: 20,
           scaleInCooldown: cdk.Duration.seconds(60),
           scaleOutCooldown: cdk.Duration.seconds(60)        
            scaleOutCooldown: cdk.Duration.seconds(60)
           scaleOutCooldown: cdk.Duration.seconds(60)        
            scaleOutCooldown: cdk.Duration.seconds(60)
           scaleOutCooldown: cdk.Duration.seconds(60)        
        })
        */

        const ordersTopic = new sns.Topic(this, "OrderEventsTopic", {
            displayName: "Orders events topic",
            topicName: "order-events"
        })

        this.ordersHandler = new lambdaNodeJS.NodejsFunction(this, "OrdersFunction", {
            functionName: "OrdersFunction",
            entry: "lambda/orders/ordersFunction.js",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(10),
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
            bundling: {
                minify: false,
                sourceMap: false,
            },
            environment: {
                PRODUCTS_DDB: props.productsDdb.tableName,
                ORDERS_DDB: ordersDdb.tableName,
                ORDERS_EVENTS_TOPIC_ARN: ordersTopic.topicArn
            },
        })

        props.productsDdb.grantReadData(this.ordersHandler)
        ordersDdb.grantReadWriteData(this.ordersHandler)
        ordersTopic.grantPublish(this.ordersHandler)

        const orderEmailsDlq = new sqs.Queue(this, "OrderEmailsDlq", {
            queueName: "order-emails-dlq"
        })

        const orderEventsHandler = new lambdaNodeJS.NodejsFunction(this, "OrderEventsFunction", {
            functionName: "OrderEventsFunction",
            entry: "lambda/orders/orderEventsFunction.js",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(10),
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
            deadLetterQueueEnabled: true,
            deadLetterQueue: orderEmailsDlq,
            retryAttempts: 2,
            //reservedConcurrentExecutions: 5,
            bundling: {
                minify: false,
                sourceMap: false,
            },
            environment: {
                EVENTS_DDB: props.eventsDdb.tableName
            },
        })
        ordersTopic.addSubscription(new subs.LambdaSubscription(orderEventsHandler))
        const eventsDdbPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem"],
            resources: [props.eventsDdb.tableArn],
            conditions: {
                ['ForAllValues:StringLike']: {
                    'dynamodb:LeadingKeys': ['#order_*']
                }
            }
        })
        orderEventsHandler.addToRolePolicy(eventsDdbPolicy)

        const paymentsHandler = new lambdaNodeJS.NodejsFunction(this, "PaymentsFunction", {
            functionName: "PaymentsFunction",
            entry: "lambda/orders/paymentsFunction.js",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(10),
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
            deadLetterQueueEnabled: true,
            bundling: {
                minify: false,
                sourceMap: false,
            }
        })
        ordersTopic.addSubscription(new subs.LambdaSubscription(paymentsHandler, {
            filterPolicy: {
                eventType: sns.SubscriptionFilter.stringFilter({
                    allowlist: ['ORDER_CREATED'],
                    denylist: ['ORDER_DELETED', 'ORDER_UPDATED']
                })
            }
        }))

        const orderEventsDlq = new sqs.Queue(this, "OrderEventsDlq", {
            queueName: "order-events-dlq",
            retentionPeriod: cdk.Duration.days(10)
        })
        //Metric
        const numberOfMessagesMetric = orderEventsDlq.metricApproximateNumberOfMessagesVisible({
            period: cdk.Duration.minutes(2),
            statistic: 'Sum'
        })
        //Alarm
        numberOfMessagesMetric.createAlarm(this, "OrderEmailFail", {
            alarmName: 'OrderEmailFail',
            alarmDescription: 'Order email fail',
            actionsEnabled: false,
            evaluationPeriods: 1,
            threshold: 5,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
        })

        //Metric
        const ageOfMessageMetric = orderEventsDlq.metricApproximateAgeOfOldestMessage({
            period: cdk.Duration.minutes(2),
            statistic: 'Maximum',
            unit: cw.Unit.SECONDS
        })
        //Alarm
        ageOfMessageMetric.createAlarm(this, "AgeOfMessagesInQueue", {
            alarmName: "AgeOfMessagesQueue",
            alarmDescription: "Maximum age of messages in order events queue",
            actionsEnabled: false,
            evaluationPeriods: 1,
            threshold: 60,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
        })

        const orderEventsQueue = new sqs.Queue(this, "OrderEventsQueue", {
            queueName: "order-events",
            deadLetterQueue: {
                maxReceiveCount: 3,
                queue: orderEventsDlq
            }
        })
        ordersTopic.addSubscription(new subs.SqsSubscription(orderEventsQueue, {
            filterPolicy: {
                eventType: sns.SubscriptionFilter.stringFilter({
                    allowlist: ['ORDER_CREATED'],
                })
            }
        }))

        const orderEmailsHandler = new lambdaNodeJS.NodejsFunction(this, "OrderEmailsFunction", {
            functionName: "OrderEmailsFunction",
            entry: "lambda/orders/orderEmailsFunction.js",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(10),
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
            bundling: {
                minify: false,
                sourceMap: false,
            }
        })
        orderEmailsHandler.addEventSource(new lambdaEventSource.SqsEventSource(orderEventsQueue/*, {
         batchSize: 5,
         enabled: true,
         maxBatchingWindow: cdk.Duration.seconds(10)
      }*/))
        orderEventsQueue.grantConsumeMessages(orderEmailsHandler)

        const orderEmailSesPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["ses:SendEmail", "ses:SendRawEmail"],
            resources: ["*"]
        })
        orderEmailsHandler.addToRolePolicy(orderEmailSesPolicy)

        this.orderEventsFetchHandler = new lambdaNodeJS.NodejsFunction(this, "OrderEventsFetchFunction", {
            functionName: "OrderEventsFetchFunction",
            entry: "lambda/orders/orderEventsFetchFunction.js",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(10),
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
            bundling: {
                minify: false,
                sourceMap: false,
            },
            environment: {
                EVENTS_DDB: props.eventsDdb.tableName
            }
        })
        const eventsFetchDdbPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:Query'],
            resources: [`${props.eventsDdb.tableArn}/index/emailIdx`],
            /*conditions: {
                              ['ForAllValues:StringLike']: {
                                  'dynamodb:LeadingKeys': ['#order_*']
                              }
                }*/
        })
        this.orderEventsFetchHandler.addToRolePolicy(eventsFetchDdbPolicy)

        //Metric
        const productNotFoundMetricFilter = this.ordersHandler.logGroup.addMetricFilter('ProductNotFoundMetric', {
            filterPattern: logs.FilterPattern.literal('Some product was not found'),
            metricName: 'OrderWithNonValidProduct',
            metricNamespace: 'ProductNotFound'
        })

        //Alarm
        const productNotFoundAlarm = productNotFoundMetricFilter
            .metric()
            .with({
                period: cdk.Duration.minutes(2),
                statistic: 'Sum'
            })
            .createAlarm(this, "ProductNotFoundAlarm", {
                alarmName: 'OrderWithNonValidProduct',
                alarmDescription: 'Some product was not found while creating a new order',
                evaluationPeriods: 1,
                threshold: 2,
                actionsEnabled: true,
                comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
            })

        //Alarm action
        const orderAlarmsTopic = new sns.Topic(this, "OrderAlarmsTopic", {
            displayName: 'Order alarms topic',
            topicName: "order-alarms"
        })
        orderAlarmsTopic.addSubscription(new subs.EmailSubscription('siecola@gmail.com'))
        productNotFoundAlarm.addAlarmAction({
            bind(): cw.AlarmActionConfig {
                return { alarmActionArn: orderAlarmsTopic.topicArn }
            }
        })

    }
}