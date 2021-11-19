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

      this.createProductsResource(apiGW, props)

      this.createOrdersResource(apiGW, props)
   }

   private createOrdersResource(apiGW: apigateway.RestApi, props: ECommerceApiStackProps) {
      const ordersFunctionIntegration = new apigateway.LambdaIntegration(props.ordersHandler)

      // /orders
      const ordersResource = apiGW.root.addResource("orders")

      //GET /orders
      //GET /orders?email=matilde@siecola.com.br
      //GET /orders?email=matilde@siecola.com.br&orderId=123
      ordersResource.addMethod("GET", ordersFunctionIntegration)

      //DELETE /orders?email=matilde@siecola.com.br&orderId=123
      ordersResource.addMethod("DELETE", ordersFunctionIntegration, {
         requestParameters: {
            'method.request.querystring.email': true,
            'method.request.querystring.orderId': true
         },
         requestValidatorOptions: {
            requestValidatorName: "Email and OrderId parameters validator",
            validateRequestParameters: true,
         }
      })

      const orderRequestValidator = new apigateway.RequestValidator(this, "OrderRequestValidator", {
         restApi: apiGW,
         requestValidatorName: 'Order request validator',
         validateRequestBody: true
      })
      const orderModel = new apigateway.Model(this, "OrderModel", {
         modelName: "OrderModel",
         restApi: apiGW,
         contentType: "application/json",
         schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
               email: {
                  type: apigateway.JsonSchemaType.STRING
               },
               productIds: {
                  type: apigateway.JsonSchemaType.ARRAY,
                  minItems: 1,
                  items: {
                     type: apigateway.JsonSchemaType.STRING,
                  }
               },
               payment: {
                  type: apigateway.JsonSchemaType.STRING,
                  enum: ["CASH", "DEBIT_CARD", "CREDIT_CARD"]
               }
            },
            required: [
               "email", "productIds", "payment"
            ]
         }
      })
      //POST /orders
      ordersResource.addMethod("POST", ordersFunctionIntegration, {
         requestValidator: orderRequestValidator,
         requestModels: { "application/json": orderModel }
      })
   }

   private createProductsResource(apiGW: apigateway.RestApi, props: ECommerceApiStackProps) {
      const productRequestValidator = new apigateway.RequestValidator(this, "ProductRequestValidator", {
         restApi: apiGW,
         requestValidatorName: `Product request validator`,
         validateRequestBody: true,
      })
      const productModel = new apigateway.Model(this, "productModel", {
         modelName: "ProductModel",
         restApi: apiGW,
         contentType: "application/json",
         schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
               productName: {
                  type: apigateway.JsonSchemaType.STRING
               },
               code: {
                  type: apigateway.JsonSchemaType.STRING
               },
               price: {
                  type: apigateway.JsonSchemaType.NUMBER
               },
               model: {
                  type: apigateway.JsonSchemaType.STRING
               },
               productUrl: {
                  type: apigateway.JsonSchemaType.STRING
               },
            },
            required: [
               "productName",
               "code"
            ]
         }
      })

      const productsFunctionIntegration = new apigateway.LambdaIntegration(props.productsHandler)
      const productsResource = apiGW.root.addResource("products")
      // GET /products
      productsResource.addMethod("GET", productsFunctionIntegration)
      // POST /products
      productsResource.addMethod("POST", productsFunctionIntegration, {
         requestValidator: productRequestValidator,
         requestModels: { "application/json": productModel }
      })

      const productIdResource = productsResource.addResource("{id}")
      // GET /products/{id}
      productIdResource.addMethod("GET", productsFunctionIntegration)
      // PUT /products/{id}
      productIdResource.addMethod("PUT", productsFunctionIntegration, {
         requestValidator: productRequestValidator,
         requestModels: { "application/json": productModel }
      })
      // DELETE /products/{id}
      productIdResource.addMethod("DELETE", productsFunctionIntegration)
   }
}