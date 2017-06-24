const dotenv = require('dotenv')
dotenv.config()

module.exports = {
  cdnUrl: process.env.CDN_URL,
  cdnKey: process.env.CDN_KEY,
  audience: process.env.AUDIENCE,
  authName: process.env.AUTHNAME,
  wpUrl: process.env.WP_URL,
  defaultPort: process.env.DEFAULT_PORT
}
