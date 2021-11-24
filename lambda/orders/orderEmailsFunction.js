const AWS = require("aws-sdk")
const AWSXray = require("aws-xray-sdk-core")

const xRay = AWSXray.captureAWS(require("aws-sdk"))

exports.handler = async function (event, context) {

    console.log('Order event')

    //TODO - to be removed
    throw 'Non valid event type'

    //event.Records.forEach((record) => {
    //    console.log(record)
    //    const body = JSON.stringify(record.body)
    //    console.log(body)
    //})

    //return {}
}