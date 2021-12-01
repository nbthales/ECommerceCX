const AWS = require("aws-sdk")
const AWSXray = require("aws-xray-sdk-core")

const xRay = AWSXray.captureAWS(require("aws-sdk"))

const awsRegion = process.env.AWS_REGION
const invoicesDdb = proccess.env.INVOICES_DDB
const invoiceWsApiEndpoint = proccess.env.INVOICE_WSAPI_ENDPOINT

AWS.config.update({
    region: awsRegion
})

const ddbClient = new AWS.DynamoDB.DocumentClient()
const s3Client = new AWS.S3({
    region: awsRegion
})

const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: invoiceWsApiEndpoint
})

exports.handler = async function (event, context) {
    //TODO - to be removed
    console.log(event.Records[0].s3)

    const key = event.Records[0].s3.object.key
    const params = {
        Key: key,
        Bucket: event.Records[0].s3.object.name
    }

    const invoiceTransactionResult = await getInvoiceTransaction(key)
    const invoiceTransaction = invoiceTransactionResult.Item

    if (invoiceTransaction) {
        if (invoiceTransaction.transactionStatus === 'URL_GENERATED') {
            await Promise.all([
                sendInvoiceStatus(invoiceTransaction.sk, invoiceTransaction.connectionId, "INVOICE_RECEIVED"),
                updateInvoiceTransaction(key, "INVOICE_RECEIVED")
            ])
        } else {
            sendInvoiceStatus(invoiceTransaction.sk, invoiceTransaction.connectionId, invoiceTransaction.transactionStatus)
            console.error(`Non valid transaction status: ${invoiceTransaction.transactionStatus}`)
            return {}
        }
    }

    const object = await s3Client.getObject(params).promise()
    const invoice = JSON.parse(object.Body.toString('utf-8'))

    const createInvoicePromise = createInvoice(invoice, key)
    const deleteInvoicePromise = s3Client.deleteObject(params).promise()

    if (invoiceTransaction) {
        await Promise.all([
            sendInvoiceStatus(invoiceTransaction.sk, invoiceTransaction.connectionId, "INVOICE_PROCESSED"),
            updateInvoiceTransaction(key, "INVOICE_PROCESSED")
        ])
    }

    await Promise.all([createInvoicePromise, deleteInvoicePromise])
}
function getInvoiceTransaction(key) {
    const params = {
        TableName: invoicesDdb,
        Key: {
            pk: "#transaction",
            sk: key
        }
    }
    return ddbClient.get(params).promise()
}
function sendInvoiceStatus(transactionId, connectionId, status) {
    const postData = JSON.stringify({
        key: transactionId,
        status: status
    })
    return apigwManagementApi.postToConnection({
        ConnectionId: connectionId,
        Data: postData
    }).promise()
}

function createInvoice(invoice, transactionId) {
    const params = {
        TableName: invoicesDdb,
        Item: {
            pk: `#invoice_${invoice.customerName}`,
            sk: invoice.invoiceNumber,
            totalValue: invoice.totalValue,
            productId: invoice.productId,
            quantity: invoice.quantity,
            transactionId: transactionId,
            ttl: 0,
            createdAt: Date.now()
        }
    }
    return ddbClient.put(params).promise()
}

function updateInvoiceTransaction(key, status) {
    return ddbClient.update({
        TableName: invoicesDdb,
        Key: {
            pk: "transaction",
            sk: key
        },
        UpdateExpression: 'set transactionStatus = :s',
        ExpressionAttributeValues: {
            ":s": status
        }
    }).promise()
}