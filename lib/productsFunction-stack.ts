import * as lambda from "@aws-cdk/aws-lambda"
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs"
import * as cdk from "@aws-cdk/core"

export class ProductsFunctionStack extends cdk.Stack{
  readonly handler: lambdaNodeJS.NodejsFunction

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps){
      super(scope, id, props)

        this.handler = new lambdaNodeJS.NodejsFunction(this, "ProductsFunction", {
            functionName: "ProductsFunction",
            entry: "lambda/products/productsFunction.js",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(30),
            bundling:{
                minify: true,
                sourceMap: false,
            },
            reservedConcurrentExecutions: 5
        })
    }
}