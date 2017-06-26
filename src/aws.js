const AWS = require('aws-sdk')
const store = require('./store')

const { awsKey, awsSecret, awsRegion } = store

const config = new AWS.Config({
  accessKeyId: awsKey,
  secretAccessKey: awsSecret,
  region: awsRegion
})
const dynamodb = new AWS.DynamoDB(config)

module.exports = {
  dynamodb
}
