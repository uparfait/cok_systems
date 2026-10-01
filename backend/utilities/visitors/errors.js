/**
 * Small HTTP error helpers shared by the visitor controllers. A thrown
 * HttpError carries the status and the JSON body the client receives.
 * Refusals use plain 403 bodies (never forbidden_resource), so the frontend
 * shows the message instead of logging the user out.
 */

class HttpError extends Error {
    constructor(status, body) {
        super(body && body.message ? body.message : 'Request failed');
        this.status = status;
        this.body = { success: false, type: status >= 500 ? 'error' : 'warning', ...body };
    }
}

const badRequest = (message, extra = {}) => new HttpError(400, { message, ...extra });
const forbidden = (message, extra = {}) => new HttpError(403, { message, ...extra });
const notFound = (message, extra = {}) => new HttpError(404, { message, ...extra });
const conflict = (message, extra = {}) => new HttpError(409, { message, ...extra });

const isDuplicateKey = (error) => !!error && (error.code === 11000 || error.code === 11001);

/** Send an HttpError as-is, anything else as a 500 with a readable message. */
function sendError(res, error, fallbackMessage = 'Something went wrong, please try again') {
    if (error instanceof HttpError) {
        return res.status(error.status).json(error.body);
    }
    console.error(fallbackMessage, error);
    return res.status(500).json({
        success: false,
        type: 'error',
        message: fallbackMessage,
        error: error && error.message ? error.message : '',
    });
}

module.exports = {
    HttpError,
    badRequest,
    forbidden,
    notFound,
    conflict,
    isDuplicateKey,
    sendError,
};
