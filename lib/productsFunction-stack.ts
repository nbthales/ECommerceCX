import * as lambda from "@aws-cdk/aws-lambda"
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs"
import * as cdk from "@aws-cdk/core"
import * as dynamodb from "@aws-cdk/aws-dynamodb"
import * as iam from "@aws-cdk/aws-iam"

interface ProductsFunctionStackProps extends cdk.StackProps {
   productsDdb: dynamodb.Table,
   eventsDdb: dynamodb.Table,
}

export class ProductsFunctionStack extends cdk.Stack {
   readonly productsHandler: lambdaNodeJS.NodejsFunction

   constructor(scope: cdk.Construct, id: string, props: ProductsFunctionStackProps) {
      super(scope, id, props)

      const productEventsHandler = new lambdaNodeJS.NodejsFunction(this, "ProductEventsFunction", {
         functionName: "ProductEventsFunction",
         entry: "lambda/products/productEventsFunction.js",
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
      })
      //props.eventsDdb.grantWriteData(productEventsHandler);
      const eventsDdbPolicy = new iam.PolicyStatement({
         effect: iam.Effect.ALLOW,
         actions: ["dynamodb:PutItem"],
         resources: [props.eventsDdb.tableArn],
         conditions: {
            ['ForAllValues:StringLike']: {
               'dynamodb:LeadingKeys': ['#product_*']
            }
         }
      })
      productEventsHandler.addToRolePolicy(eventsDdbPolicy)


      this.productsHandler = new lambdaNodeJS.NodejsFunction(this, "ProductsFunction", {
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
            PRODUCTS_DDB: props.productsDdb.tableName,
            PRODUCT_EVENTS_FUNCTION_NAME: productEventsHandler.functionName
         },
      })
      props.productsDdb.grantReadWriteData(this.productsHandler)

      productEventsHandler.grantInvoke(this.productsHandler)

   }
}