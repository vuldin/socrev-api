const WPAPI = require('wpapi')
const request = require('superagent')
const attr = require('dynamodb-data-types').AttributeValue
const { JSDOM } = require('jsdom')
const store = require('./store')
const { dynamodb } = require('./aws')

const { cmsApiUrl, cmsApiUser, cmsApiPassword } = store
const tableName = 'posts'
let waitForTableCreation = 0 // amount of time to wait after creating table before migrating wp posts
let wp = new WPAPI({
  endpoint: cmsApiUrl,
  username: cmsApiUser,
  password: cmsApiPassword,
  auth: true
})

// create posts table if it doesn't exist
const initTable = async () => {
  const data = await dynamodb.listTables({}).promise()
  if (!data.TableNames.includes(tableName)) {
    // create table
    waitForTableCreation = 10 * 1000 // wait for 10 seconds once table is created to migrate posts
    const params = {
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' } //Partition key
      ],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'N' }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10
      }
    }
    const createTableResponse = await dynamodb.createTable(params).promise()
    console.log(
      'Created table. Table description JSON:',
      JSON.stringify(createTableResponse, null, 2)
    )
  }
}

// pulls posts from wordpress, transforms, then push to dynamoDB
const migratePosts = async () => {
  //console.log('migratePosts start')
  // pull wordpress posts, dynamo posts, and media
  const [
    wpPostsRes,
    mediaRes,
    dynamoPostsRes,
    wpCategories
  ] = await Promise.all([
    wp.posts(),
    dynamodb.scan({ TableName: 'media' }).promise(),
    dynamodb.scan({ TableName: 'posts' }).promise(),
    wp.categories()
  ])
  let wpPosts = wpPostsRes
  let media = mediaRes.Items.map(item => attr.unwrap(item))
  let oldDynamoPosts = dynamoPostsRes.Items.map(item => attr.unwrap(item))

  // categories
  let featureCatId = wpCategories.filter(c => c.name === 'Feature')
  if (featureCatId.length > 0) featureCatId = featureCatId[0].id

  // filter out wpPosts which have not been modified since last merge
  let newWpPostCount = 0
  let modWpPostCount = 0
  wpPosts = wpPosts.filter(wp => {
    let result = true
    // if post is found in dynamo, then filter based on modified date
    if (oldDynamoPosts.filter(dp => dp.id === wp.id).length > 0) {
      //console.log(`in dynamo: ${wp.slug}`)
      result =
        oldDynamoPosts.filter(
          dp => dp.id === wp.id && dp.modified !== wp.modified
        ).length > 0
      if (result) modWpPostCount++
      //console.log(`  ${result}`)
    } else {
      newWpPostCount++
      //console.log(`new: ${wp.slug}`)
      //console.log(`  ${result}`)
    }
    return result
  })
  console.log('post updates since last merge:')
  console.log(`  ${modWpPostCount} modified`)
  console.log(`  ${newWpPostCount} created`)

  // create a dynamo post for each wp post
  let posts = wpPosts.map(wp => {
    let isFeatured = false
    const catMatches = wp.categories.filter(c => c === featureCatId)
    if (catMatches.length > 0) isFeatured = true
    let result = {
      /* the following props remain undefined at this point:
       *   author: '',
       *   tags: [],
       *   featuredImage: [Object],
       *   excerpt: '',
       */
      id: wp.id,
      slug: wp.slug,
      status: wp.status,
      title: wp.title.rendered,
      isFeatured: isFeatured,
      date: wp.date,
      modified: wp.modified,
      content: wp.content_rawmod.map(entry => {
        let result = entry
        if (entry.substring(0, 8) === '[caption') {
          // entry is caption + image
          entry = entry.split(/[\[\]]/)[2]
          let caption = entry.match(/[\>].*/)[0].substring(2)
          entry = entry.replace(`> ${caption}`, '>')
        }
        if (entry.substring(0, 4) === '<img') {
          // entry is an image
          const dom = new JSDOM(entry)
          const imgDom = dom.window.document.querySelector('img')
          const url = imgDom.src
          let mediaObj = {}
          if (url.includes('marx.imageresizer.io')) {
            // image is from CDN
            let mId = url.split('/')[3].replace(/\..*/g, '')
            mediaObj = media.filter(m => m.id === mId)[0]
          } else {
            // TODO add image to CDN
            mediaObj = {
              url: url,
              altText: imgDom.alt
            }
          }
          result = {
            type: 'image',
            val: mediaObj
          }
        }
        return result
      })
    }
    // grab first string content entry for excerpt
    // TODO handle other entry types (ie. em, h2)
    result.excerpt = result.content.filter(e => typeof e === 'string')[0]
    /*
    console.log()
    console.log('after wp')
    console.log(result)
    */

    // merge with existing dynamo post if exists
    const dynamoMatches = oldDynamoPosts.filter(p => p.id === wp.id)
    if (dynamoMatches.length > 0) {
      result = { ...dynamoMatches[0], ...result }
    }
    /*
    console.log()
    console.log('after dynamo')
    console.log(result)
    */

    // if featuredImage doesn't exist, then create
    if (result.featuredImage === undefined) {
      // search for featured image in media
      media.forEach(m => {
        if (m.featureFor !== undefined) {
          if (m.featureFor.includes(result.id)) {
            // found feature for post in media
            result.featuredImage = m
          }
        }
      })
      // if still not found, then pull from article contents
      if (result.featuredImage === undefined) {
        let images = result.content
          .filter(e => typeof e !== 'string')
          .filter(e => e.type === 'image')
        if (images.length > 0) {
          // found feature for post in contents
          result.featuredImage = images[0].val
        }
      }
    }

    return attr.wrap(result)
  })
  /*
  console.log()
  console.log('dynamoposts')
  console.log(posts)
  */

  // add any posts to dynamo
  if (posts.length > 0) {
    const dynamoResult = await dynamodb
      .batchWriteItem({
        RequestItems: {
          posts: posts.map(p => {
            return {
              PutRequest: {
                Item: p
              }
            }
          })
        },
        ReturnConsumedCapacity: 'TOTAL',
        ReturnItemCollectionMetrics: 'SIZE'
      })
      .promise()
  } else console.log('no dynamo updates')
  /*
  console.log()
  console.log('dynamo result')
  console.log(dynamoResult)
  */
  //console.log('migratePosts complete')
}

// calls initTable and migratePosts synchronously
let init = async () => {
  //await wpInit()
  await initTable()
  setTimeout(async () => {
    await migratePosts()
  }, waitForTableCreation)
}
init()

module.exports = (app, checkJwt, checkScopes) => {
  app.get('/posts', async (req, res) => {
    const data = await dynamodb.scan({ TableName: tableName }).promise()
    const items = data.Items
    const unwrappedItems = items.map(item => attr.unwrap(item))
    res.json(unwrappedItems)
  })
  app.get('/posts/:id', async (req, res) => {
    /*
    const postRes = await request.get(`${cmsApiUrl}/posts/${req.params.id}`)
    let postResJson = JSON.parse(postRes.text)
    res.json(postResJson)
    */
    const dynamoParams = {
      Key: { id: { S: req.params.id } },
      TableName: tableName
    }
    dynamodb.getItem(dynamoParams, (err, data) => {
      if (err) res.status(500).json(err)
      else res.json(attr.unwrap(data.Item))
    })
  })
  /*
  app.get('/users', checkJwt, checkScopes, async (req, res) => {
    const usersRes = await request.get(`${cmsApiUrl}/users`)
    let users = JSON.parse(usersRes.text)
    res.json(users)
  })
  */
  app.get('/categories', async (req, res) => {
    const categoriesRes = await request.get(`${cmsApiUrl}/categories`)
    let categories = JSON.parse(categoriesRes.text)
    res.json(categories)
  })
  app.get('/migrate', async (req, res) => {
    await migratePosts()
    res.send()
  })
}
