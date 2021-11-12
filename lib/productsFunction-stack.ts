import * as lambda from "@aws-cdk/aws-lambda"
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs"
import * as cdk from "@aws-cdk/core"
import * as dynamodb from "@aws-cdk/aws-dynamodb"

interface ProductsDbdStackProps extends cdk.StackProps {
    productsDbd: dynamodb.Table,
    eventsDdb: dynamodb.Table,
}

export class ProductsFunctionStack extends cdk.Stack {
    readonly productsHander: lambdaNodeJS.NodejsFunction

    constructor(scope: cdk.Construct, id: string, props: ProductsDbdStackProps) {
        super(scope, id, props)

        const productEventsHandler = new lambdaNodeJS.NodejsFunction(this, "ProductEventsFunction", {
            functionName: "ProductEventsFunction",
            entry: "lambda/products/productsEventsFunction.js",
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
            },
            //reservedConcurrentExecutions: 5
        })
        props.eventsDdb.grantWriteData(productEventsHandler);

        this.productsHander = new lambdaNodeJS.NodejsFunction(this, "ProductsFunction", {
            functionName: "ProductsFunction",
            entry: "lambda/products/productsFunction.js",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(30),
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
            bundling: {
                minify: false,
                sourceMap: false,
            },
            environment: {
                PRODUCTS_DDB: props.productsDbd.tableName,
                PRODUCT_EVENTS_FUNCTION_NAME: productEventsHandler.functionName
            },
            //reservedConcurrentExecutions: 5
        })
        props.productsDbd.grantReadWriteData(this.productsHander)

        productEventsHandler.grantInvoke(this.productsHander);
    }
}