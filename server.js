const express = require('express')
const app = express()
const jwt = require('express-jwt')
const authz = require('express-jwt-authz')
const jwks = require('jwks-rsa')
const cors = require('cors')
const request = require('superagent')
const morgan = require('morgan')
const dotenv = require('dotenv')

dotenv.config()
const cdnUrl = process.env.CDN_URL
const cdnKey = process.env.CDN_KEY
const audience = process.env.AUDIENCE
const authName = process.env.AUTHNAME
const wpUrl = process.env.WP_URL

const port = process.env.PORT || 3001
app.use(cors())
app.use(
  morgan(
    `API Request (port ${port}): :method :url :status :response-time ms - :res[content-length]`
  )
)

const checkJwt = jwt({
  secret: jwks.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${authName}.auth0.com/.well-known/jwks.json`
  }),
  audience: audience,
  issuer: `https://${authName}.auth0.com/`,
  algorithms: ['RS256']
})

// app.use(checkJwt) // applies auth to all endpoints

// TODO handle passing in scope as argument on input methods below
const checkScopes = authz(['read:posts'])

app.get('/posts', async (req, res) => {
  const postsRes = await request.get(`${wpUrl}/posts`)
  let posts = JSON.parse(postsRes.text)
  res.json(posts)
})
/*
app.get('/users', async (req, res) => {
  const usersRes = await request.get(
    'https://socialistrevolution.org/wp/wp-json/wp/v2/users'
  )
  let users = JSON.parse(usersRes.text)
  res.json(users)
})
*/
app.get('/categories', async (req, res) => {
  const categoriesRes = await request.get(`${wpUrl}/categories`)
  console.log(categoriesRes)
  let categories = JSON.parse(categoriesRes.text)
  res.json(categories)
})

app.get('/profile', checkJwt, checkScopes, (req, res) => {
  res.json({
    response: 'success',
    message: 'private response'
  })
})

app.post('/upload', async (req, res) => {
  // TODO see what property to use
  console.log(req)
  const mediaObj = req.body
  const uploadRes = await request.get(cdnUrl).query({
    key: cdnKey,
    url: encodeUri(mediaObj.url)
  })
  res.json(uploadRes)
})

app.listen(port)
