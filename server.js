const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const jwt = require('express-jwt')
const authz = require('express-jwt-authz')
const jwks = require('jwks-rsa')
const cors = require('cors')
const request = require('superagent')
const morgan = require('morgan')
//const mediaModule = require('./src/media')
const cmsModule = require('./src/cms')
const constants = require('./src/constants')
const primer = require('./src/primer')

//require('appmetrics-dash').monitor()

const { authAudience, authName, defaultPort } = constants
const port = process.env.PORT || defaultPort

process.on('unhandledRejection', (reason, p) => {
  console.log('unhandled rejection at:', p)
  console.log('reason:', reason)
})

// TODO change during testing
//const refreshTimer = 1000 * 15
const refreshTimer = 1000 * 60 * 5

primer.prime().then(() => {
  setInterval(async () => {
    console.log('start refresh loop now')
    await primer.refresh()
    console.log('refresh loop COMPLETE')
  }, refreshTimer)
})

app.use(cors())
app.use(bodyParser.json())
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
  audience: authAudience,
  issuer: `https://${authName}.auth0.com/`,
  algorithms: ['RS256']
})

// TODO handle passing in scope as argument on input methods below
const checkScopes = authz(['read:posts'])

//mediaModule(app, checkJwt, checkScopes)
cmsModule(app, checkJwt, checkScopes)

const server = app.listen(port, () =>
  console.log(`listening on ${server.address().port}`)
)
