import * as lambda from "@aws-cdk/aws-lambda"
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs"
import * as cdk from "@aws-cdk/core"
import * as dynamodb from "@aws-cdk/aws-dynamodb"

interface ProductsDbdStackProps extends cdk.StackProps {
    productsDbd: dynamodb.Table
}

export class ProductsFunctionStack extends cdk.Stack{
  readonly handler: lambdaNodeJS.NodejsFunction

  constructor(scope: cdk.Construct, id: string, props: ProductsDbdStackProps){
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
            environment: {
                PRODUCTS_DDB: props.productsDbd.tableName
            },
            reservedConcurrentExecutions: 5
        })
        props.productsDbd.grantReadWriteData(this.handler)
    }
}