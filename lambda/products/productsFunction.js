const AWS = require("aws-sdk")
const AWSXray = require("aws-xray-sdk-core")
const uuid = require("uuid")

const xRay = AWSXray.captureAWS(require("aws-cdk"))

const productsDbd = process.env.PRODUCTS_DDB
const awsRegion = process.env.AWS_REGION
const productEventsFunctionName = process.env.PRODUCTS_EVENTS_FUNCTION_NAME

AWS.config.update({
    region: awsRegion
})

const ddbClient = new AWS.DynamoDB.DocumentClient()
const lambdaClient = new AWS.Lambda()

exports.handler = async function (event, context) {
    const method = event.httpMethod

    //TODO - to be removed
    //console.log(event);

    const apiRequestId = event.requestContext.requestId;
    const lambdaRequestId = context.awsRequestId;

    //console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)
    if (event.resource === '/products') {
        // products
        if (method === 'GET') {
            const data = await getAllProducts()

            return {
                statusCode: 200,
                body: JSON.stringify(data.Items)
                //                headers: {},
                //                body: JSON.stringify({
                //                    message: "GET Products",
                //                    apiGwRequestId: apiRequestId,
                //                    lambdaRequestId: lambdaRequestId
            }
        } else if (method === 'POST') {
            //POST /products
            const product = JSON.parse(event.body)
            product.id = uuid.v4()

            await createProduct(product)
            await sendProductEvent(product, "PRODUCT_CREATED", "nbthales@gmail.com", lambdaRequestId)

            return {
                statusCode: 201,
                body: JSON.stringify(product)
            }
        }
    } else if (event.resource === '/products/{id}') {
        const productId = event.pathParameters.id
        if (method === 'GET') {
            //GET /products/{id}
            const data = await getProductById(productId)
            if (data.Item) {
                return {
                    statusCode: 200,
                    body: JSON.stringify(data.Item)
                }
            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify(`Product with id ${productId} not found`)
                }
            }
        } else if (method === 'PUT') {
            //PUT /products/{id}
            const data = await getProductById(productId)
            if (data.Item) {
                const product = JSON.parse(event.body)
                await updateProduct(productId, product)
                await sendProductEvent(product, "PRODUCT_UPDATED", "nbthales2@gmail.com", lambdaRequestId)
                return {
                    statusCode: 200,
                    body: JSON.stringify(product)
                }
            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify(`Product with ID ${productId} not found`)
                }
            }

        } else if (method === 'DELETE') {
            //DELETE /products/{id}
            const data = await getProductById(productId)
            if (data.Item) {
                const deletePromise = deleteProduct(productId)
                const sendEventPromise = sendProductEvent(data.Item, "PRODUCT_DELETED", "nbthales3@gmail.com", lambdaRequestId)

                const result = await Promise.all([deletePromise, sendEventPromise])
                console.log(result[1])

                return {
                    statusCode: 200,
                    body: JSON.stringify(data.Item)
                }
            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify(`Product with ID ${productId} not found`)
                }
            }
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "Bad request",
            apiGwRequestId: apiRequestId,
            lambdaRequestId: lambdaRequestId
        })
    }

}

function sendProductEvent(product, event, email, lambdaRequestId) {
    const params = {
        FunctionName: productEventsFunctionName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify({
            productEvent: {
                requestId: lambdaRequestId,
                eventType: event,
                productId: product.id,
                productCode: product.code,
                productPrice: product.price,
                email: email
            }
        })
    }
    return lambdaClient.invoke(params).promise()
}

function deleteProduct(productId) {
    ddbClient.delete()
    const params = {
        TableName: productsDbd,
        Key: {
            id: productId
        }
    }
    return ddbClient.delete(params).promise()
}

//function updateProductPrice(productId, price){
//    const params = {
//        TableName: productsDbd,
//        Key:{
//            id: productId
//        },
//        UpdateExpression: "set productName = price = :p",
//        ExpressionAttributeValues:{
//            ":p": product.price
//        }
//    }
//    return ddbClient.update(params).promise()
//}

function updateProduct(productId, product) {
    const params = {
        TableName: productsDbd,
        Key: {
            id: productId
        },
        UpdateExpression: "set productName = :n, code = :c, price = :p, model = :m",
        ExpressionAttributeValues: {
            ":n": product.productName,
            ":c": product.code,
            ":p": product.price,
            ":m": product.model
        }
    }
    return ddbClient.update(params).promise()
}

function createProduct(product) {
    const params = {
        TableName: productsDbd,
        Item: {
            id: product.id,
            productName: product.productName,
            code: product.code,
            price: product.price,
            model: product.model
        }
    }
    return ddbClient.put(params).promise()
}

function getProductById(productId) {
    const params = {
        TableName: productsDbd,
        Key: {
            id: productId
        }
    }
    return ddbClient.get(params).promise()
}

function getAllProducts() {
    const params = {
        TableName: productsDbd
    }
    return ddbClient.scan(params).promise()
}

