const AWS = require("aws-sdk")
const AWSXray = require("aws-xray-sdk-core")

const xRay = AWSXray.captureAWS(require("aws-sdk"))
const awsRegion = process.env.AWS_REGION

AWS.config.update({
    region: awsRegion
})

const sesClient = new AWS.SES({ apiVersion: '2010-12-01' })

exports.handler = async function (event, context) {

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
    try {
        const envelope = JSON.parse(body.Message)
        const event = JSON.parse(envelope.data)
        console.log('logEvent: ', event);
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
    } catch (error) {
        console.log(error);
        return
    }
}