const request = require('superagent')
const attr = require('dynamodb-data-types').AttributeValue
const store = require('./store')
const { dynamodb } = require('./aws')

const { cdnApiUrl, cdnKey } = store
const tableName = 'media'

// list tables, then create media table if it doesn't exist
dynamodb.listTables({}, (err, data) => {
  if (!data.TableNames.includes(tableName)) {
    const params = {
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' } //Partition key
      ],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10
      }
    }
    dynamodb.createTable(params, (err, data) => {
      if (err) {
        console.error(
          'Unable to create table. Error JSON:',
          JSON.stringify(err, null, 2)
        )
      } else {
        console.log(
          'Created table. Table description JSON:',
          JSON.stringify(data, null, 2)
        )
      }
    })
  }
})

module.exports = (app, checkJwt, checkScopes) => {
  app.get('/media', (req, res) => {
    dynamodb.scan({ TableName: tableName }, (err, data) => {
      if (err) res.status(500).json(err)
      else {
        const items = data.Items
        const unwrappedItems = items.map(item => attr.unwrap(item))
        res.json(unwrappedItems)
      }
    })
  })
  app.get('/media/:id', (req, res) => {
    const dynamoParams = {
      Key: { id: { S: req.params.id } },
      TableName: tableName
    }
    dynamodb.getItem(dynamoParams, (err, data) => {
      if (err) res.status(500).json(err)
      else res.json(attr.unwrap(data.Item))
    })
  })
  // TODO add authentication, use correct scope
  //app.post('/media', checkJwt, checkScopes, async (req, res) => {
  app.post('/media', async (req, res) => {
    const cdnRes = await request.get(`${cdnApiUrl}/images`).query({
      key: cdnKey,
      url: req.body.url,
      with_mini_preview: true
    })
    const cdnResJson = JSON.parse(cdnRes.text)
    const mediaObj = { ...cdnResJson.response, ...req.body }
    console.log(mediaObj)

    const dynamoMediaObj = attr.wrap(mediaObj)
    const dynamoParams = {
      Item: dynamoMediaObj,
      TableName: tableName,
      ReturnValues: 'ALL_OLD'
    }
    dynamodb.putItem(dynamoParams, (err, data) => {
      if (err) res.status(500).json(err)
      else
        res.json({
          cdnResponse: cdnResJson,
          dynamoResponse: data
        })
    })
  })
  //app.delete('/media/:id', checkJwt, checkScopes, async (req, res) => {
  app.delete('/media/:id', async (req, res) => {
    // TODO check that image exists before attempting to delete on CDN
    const cdnRes = await request
      .get(`${cdnApiUrl}/images/${req.params.id}/delete`)
      .query({
        key: cdnKey
      })
    const dynamoParams = {
      Key: { id: { S: req.params.id } },
      TableName: tableName,
      ReturnValues: 'ALL_OLD'
    }
    dynamodb.deleteItem(dynamoParams, (err, data) => {
      if (err) res.status(500).json(err)
      else
        res.json({
          cdnResponse: JSON.parse(cdnRes.text),
          dynamoResponse: data
        })
    })
  })
}
