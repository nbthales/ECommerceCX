const AWS = require("aws-sdk")
const AWSXray = require("aws-xray-sdk-core")

const xRay = AWSXray.captureAWS(require("aws-sdk"))
const awsRegion = process.env.AWS_REGION

AWS.config.update({
    region: awsRegion
})

const sesClient = new AWS.SES({ apiVersion: '2010-12-01' })

exports.handler = async function (event, context) {

    /*
    {
     "eventType": "ORDER_CREATED",
     "data": {
         "email": "matilde@siecola.com.br",
         "orderId": "0236a08d-ff14-48a3-bf98-ef419c7e6763",
         "billing": {
             "payment": "CASH",
             "totalPrice": 31
         },
         "shipping": {
             "type": "URGENT",
             "carrier": "FEDEX"
         },
         "productCodes": [
             "COD1",
             "COD2"
         ],
         "requestId": "f470cf12-9c8a-49e0-8fb6-503273e849da"
     }
    }
    */

    console.log('Order event')
    const promises = []
    //TODO - to be removed
    //throw 'Non valid event type'

    event.Records.forEach((record) => {
        //console.log(record)
        //console.log(body)
        const body = JSON.parse(record.body)
        //sendOrderEmail(body)
        promises.push(sendOrderEmail(body))
    })

    await Promise.all(promises)

    return {}
}

function sendOrderEmail(body) {
    const envelope = JSON.parse(body.Message)
    const event = JSON.parse(envelope.data)

    const params = {
        Destination: {
            ToAddresses: [event.email]
        },
        Message: {
            Body: {
                Text: {
                    Charset: "UTF-8",
                    Data: `Recebemos seu pedido de número ${event.orderId}, no valor de R$ ${event.billing.totalPrice}.`
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: 'Recebemos seu pedido!'
            }
        },
        Source: 'nbthales2@gmail.com',
        ReplyToAddresses: ['nbthales@gmail.com']
    }
    return sesClient.sendEmail(params).promise()
}