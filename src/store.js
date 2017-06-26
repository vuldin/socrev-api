const dotenv = require('dotenv')
dotenv.config()

module.exports = {
  defaultPort: process.env.DEFAULT_PORT,
  cdnApiUrl: process.env.CDN_API_URL,
  cdnKey: process.env.CDN_KEY,
  authAudience: process.env.AUTH_AUDIENCE,
  authName: process.env.AUTH_NAME,
  cmsApiUrl: process.env.CMS_API_URL,
  awsKey: process.env.AWS_KEY,
  awsSecret: process.env.AWS_SECRET,
  awsRegion: process.env.AWS_REGION
}
