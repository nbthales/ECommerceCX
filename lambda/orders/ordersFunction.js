const AWS = require("aws-sdk")
const AWSXray = require("aws-xray-sdk-core")
const uuid = require("uuid")

const xRay = AWSXray.captureAWS(require("aws-sdk"))

const productsDdb = process.env.PRODUCTS_DDB
const ordersDdb = process.env.ORDERS_DDB
const awsRegion = process.env.AWS_REGION

AWS.config.update({
    region: awsRegion
})

const ddbClient = new AWS.DynamoDB.DocumentClient()

exports.handler = async function (event, context) {
    const method = event.httpMethod;

    const apiRequestId = event.requestContext.requestId;
    const lambdaRequestId = context.awsRequestId;

    console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)

    if (event.resource === '/orders') {
        if (method === 'GET') {
            if (event.queryStringParameters) {
                if (event.queryStringParameters.email) {
                    if (event.queryStringParameters.orderId) {
                        //Get all orders from an user
                    } else {
                        //Get a specific order
                    }
                }
            } else {
                //Get all orders
            }
        } else if (method === 'POST') {
            //Create an order
            const orderRequest = JSON.parse(event.body)
            const result = await fetchProducts(orderRequest)
            if (result.Responses.products.length == orderRequest.productIds.length) {
                const products = []
                result.Responses.products.forEach((product) => {
                    products.push(product)
                })
                const orderCreated = await createOrder(orderRequest, products)

                return {
                    statusCode: 201,
                    body: JSON.stringify(convertToOrderResponse(orderCreated))
                }
            } else {
                return {
                    statusCode: 404,
                    body: 'Some product was not found'
                }
            }

            //await createOrder(orderRequest, products)
        } else if (method === 'DELETE') {
            //Delete an order
        }
    }
    return {
        statusCode: 400,
        body: JSON.stringify('Bad request')
    }
}

function fetchProducts(orderRequest) {
    const keys = []

    /*
    [
        {
            id: "123-abc"
        },
        {
            id: "456-bca"
        }
    ]
    */

    orderRequest.productIds.forEach((productId) => {
        keys.push({
            id: productId
        })
    })

    const params = {
        RequestItems: {
            [productsDdb]: {
                Keys: keys
            }/*,
            [ordersDdb]:{

            }*/
        }
    }
    return ddbClient.batchGet(params).promise() //where in
}

async function createOrder(orderRequest, products) {
    const timestamp = Date.now()
    const orderProducts = []
    let totalPrice = 0;

    products.forEach((product) => {
        totalPrice += product.price

        orderProducts.push({
            code: product.code,
            price: product.price
        })
    })

    const orderItem = {
        pk: orderRequest.email,
        sk: uuid.v4(),
        createdAt: timestamp,
        billing: {
            payment: orderRequest.payment,
            totalPrice: totalPrice
        },
        shipping: {
            type: orderRequest.shipping.type,
            carrier: orderRequest.shipping.carrier
        },
        products: orderProducts
    }
    await ddbClient.put({
        TableName: ordersDdb,
        Item: orderItem
    }).promise()
    return orderItem
}

//Order response
/*
{
    "email": "mailta@siecola.com.br",
    "id": "123-abc",
    "createdAt": 123456,
    "products": [
        {
            "code": "COD1",
            "price": 10.5
        }
    ],
    "billing": {
        "payment": "CASH",
        "totalPrice": 21.0
    },
    "shipping": {
        "type": "URGENT",
        "carrier": "FEDEX"
    }
}
*/
function convertToOrderResponse(order) {
    return {
        email: order.pk,
        id: order.sk,
        createdAt: order.createdAt,
        products: order.products,
        billing: {
            payment: order.billing.payment,
            totalPrice: order.billing.totalPrice
        },
        shipping: {
            type: order.shipping.type,
            carrier: order.shipping.carrier
        }
    }
}