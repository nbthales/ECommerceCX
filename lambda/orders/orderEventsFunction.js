const AWS = require("aws-sdk")
const AWSXray = require("aws-xray-sdk-core")

const xRay = AWSXray.captureAWS(require("aws-sdk"))

const awsRegion = process.env.AWS_REGION
const eventsDdb = process.env.EVENTS_DDB

AWS.config.update({
   region: awsRegion   
})

const ddbClient = new AWS.DynamoDB.DocumentClient()

exports.handler = async function (event, context) {
   const promises = []

   //throw 'Non valid event type'

   event.Records.forEach((record) => {
      promises.push(createEvent(record.Sns))
   })

   await Promise.all(promises)

   return {}
}

function createEvent(body) {
   const envelope = JSON.parse(body.Message)
   const event = JSON.parse(envelope.data)

   console.log(`Creating order event - MessageId: ${body.MessageId}`)

   const timestamp = Date.now()
   const ttl = ~~(timestamp / 1000 + 5 * 60) // 5 minutes ahead, in seconds
   const params = {
      TableName: eventsDdb,
      Item: {
         pk: `#order_${event.orderId}`,
         sk: `${envelope.eventType}#${timestamp}`,   //ORDER_CREATED#123516
         ttl: ttl,
         email: event.email,
         createdAt: timestamp,
         requestId: event.requestId,
         eventType: envelope.eventType,
         info: {
            orderId: event.orderId,
            productCodes: event.productCodes,
            messageId: body.MessageId
         }
      }
    }
    return ddbClient.put(params).promise()
}