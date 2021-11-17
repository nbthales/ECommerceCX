import * as cdk from "@aws-cdk/core"
import * as apigateway from "@aws-cdk/aws-apigateway"
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs"

interface ECommerceApiStackProps extends cdk.StackProps {
   productsHandler: lambdaNodeJS.NodejsFunction,
   ordersHandler: lambdaNodeJS.NodejsFunction
}

export class ECommerceApiStack extends cdk.Stack {

   constructor (scope: cdk.Construct, id: string, props: ECommerceApiStackProps) {
      super(scope, id, props)

      const apiGW = new apigateway.RestApi(this, "ecommerce-api", {
         restApiName: "Ecommerce Service",
         description: "This is the Ecommerce service",           
      })

      const productsFunctionIntegration = new apigateway.LambdaIntegration(props.productsHandler)

      const productsResource = apiGW.root.addResource("products")
      // GET /products
      productsResource.addMethod("GET", productsFunctionIntegration)
      // POST /products
      productsResource.addMethod("POST", productsFunctionIntegration)
      const productIdResource = productsResource.addResource("{id}")
      // GET /products/{id}
      productIdResource.addMethod("GET", productsFunctionIntegration)
      // PUT /products/{id}
      productIdResource.addMethod("PUT", productsFunctionIntegration)
      // DELETE /products/{id}
      productIdResource.addMethod("DELETE", productsFunctionIntegration)

      const ordersFunctionIntegration = new apigateway.LambdaIntegration(props.ordersHandler)
      // /orders
      const ordersResource = apiGW.root.addResource("orders")

      //GET /orders
      //GET /orders?email=matilde@siecola.com.br
      //GET /orders?email=matilde@siecola.com.br&orderId=123
      ordersResource.addMethod("GET", ordersFunctionIntegration)

      //DELETE /orders?email=matilde@siecola.com.br&orderId=123
      ordersResource.addMethod("DELETE", ordersFunctionIntegration)

      //POST /orders
      ordersResource.addMethod("POST", ordersFunctionIntegration)
      
   }
}