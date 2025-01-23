const Uploader = require('../Uploader')
const logger = require('../logger')

async function startDownUpload({ req, res, getSize, download }) {
  logger.debug('Starting download stream.', null, req.id)
  const { stream, size: maybeSize } = await download()

  let size
  // if the provider already knows the size, we can use that
  if (typeof maybeSize === 'number' && !Number.isNaN(maybeSize) && maybeSize > 0) {
    size = maybeSize
  }
  // if not we need to get the size
  if (size == null) {
    size = await getSize()
  }
  const { clientSocketConnectTimeout } = req.companion.options

  logger.debug('Instantiating uploader.', null, req.id)
  const uploader = new Uploader(Uploader.reqToOptions(req, size))

    // "Forking" off the upload operation to background, so we can return the http request:
    ; (async () => {
      // wait till the client has connected to the socket, before starting
      // the download, so that the client can receive all download/upload progress.
      logger.debug('Waiting for socket connection before beginning remote download/upload.', null, req.id)
      await uploader.awaitReady(clientSocketConnectTimeout)
      logger.debug('Socket connection received. Starting remote download/upload.', null, req.id)

      await uploader.tryUploadStream(stream, req)
    })().catch((err) => logger.error(err))

  // Respond the request
  // NOTE: the Uploader will continue running after the http request is responded
  res.status(200).json({ token: uploader.token })
}

module.exports = { startDownUpload }
