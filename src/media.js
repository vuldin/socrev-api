const request = require('superagent')
const store = require('./store')
const { cdnUrl, cdnKey } = store

module.exports = (app, checkJwt, checkScopes) => {
  app.post('/media', async (req, res) => {
    let mediaObj = req.body
    const { url, tags } = mediaObj
    const cdnRes = await request.get(cdnUrl).query({
      key: cdnKey,
      url: url,
      tags: tags.toString(),
      with_mini_preview: true
    })
    const cdnResJson = JSON.parse(cdnRes.text).response
    const result = Object.assign({}, mediaObj, cdnResJson)
    res.json(result)
  })
}
