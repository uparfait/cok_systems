/**
 * Shared by the parking lists (records, search, flagged, flag history):
 * paging, the free text search (the plate on the record, the person through
 * the visitors collection) and the time parked so far for cars inside.
 */

const Visitor = require('../../models/visitor.js')
const { escapeRegex, normalizeIdNumber, normalizePlate } = require('../../utilities/visitors')

/** A query parameter as trimmed text (repeated keys arrive as arrays). */
const queryText = (value) => String((Array.isArray(value) ? value[0] : value) ?? '').trim()

/** Page and limit from the query string: never NaN, never below 1, limit capped. */
function pageParams(query, { limit: fallback = 10, max = 50 } = {}) {
    const q = query || {}
    const limit = Math.min(Math.max(parseInt(queryText(q.limit), 10) || fallback, 1), max)
    const page = Math.max(parseInt(queryText(q.page), 10) || 1, 1)
    return { page, limit, skip: (page - 1) * limit }
}

const contains = (text) => ({ $regex: escapeRegex(text), $options: 'i' })

/**
 * Telephone values to look for. Only text made of digits and phone
 * punctuation is a telephone, so the digits of a plate never match phones.
 * Stored phones are 07XXXXXXXX: a typed +250 7... / 250 7... is also
 * searched in that local form.
 */
function phoneForms(text) {
    if (!/^\+?[\d\s().-]+$/.test(text)) return []
    const digits = text.replace(/\D/g, '')
    if (!digits) return []
    return digits.startsWith('2507') ? [digits, '0' + digits.slice(3)] : [digits]
}

/** Ids of the visitors whose name, email, ID number or telephone contains the text. */
function visitorIdsMatching(text) {
    const or = [{ full_name: contains(text) }, { email: contains(text) }]
    const idNumber = normalizeIdNumber(text)
    if (idNumber) or.push({ 'identification.number': contains(idNumber) })
    phoneForms(text).forEach((phone) => or.push({ telephone: contains(phone) }))
    return Visitor.distinct('_id', { $or: or })
}

/**
 * Filter for parking records matching free text: the plate (typed with or
 * without spaces and dashes) or the person who came with the car.
 * @returns {Promise<object|null>} null when there is nothing to search
 */
async function recordSearchFilter(value) {
    const text = queryText(value)
    if (!text) return null
    const plates = [...new Set([normalizePlate(text), text.replace(/\s+/g, '')].filter(Boolean))]
    const or = plates.map((plate) => ({ plate_number: contains(plate) }))
    const visitorIds = await visitorIdsMatching(text)
    if (visitorIds.length) or.push({ visitor: { $in: visitorIds } })
    return { $or: or }
}

/** Time parked so far for cars inside; the stored duration for finished sessions. */
function withLiveDuration(row, now = new Date()) {
    if (row.status !== 'active') {
        return { ...row, current_duration: row.duration, current_duration_hours: parseFloat(row.duration) / 60 || 0 }
    }
    const ms = row.check_in ? Math.max(0, now - new Date(row.check_in)) : 0
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const hoursParked = hours + (minutes / 60)
    return {
        ...row,
        current_duration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes} mins`,
        current_duration_hours: hoursParked,
        is_near_limit: hoursParked >= 7,
        is_over_limit: hoursParked >= 8,
    }
}

module.exports = {
    queryText,
    pageParams,
    contains,
    phoneForms,
    visitorIdsMatching,
    recordSearchFilter,
    withLiveDuration,
}
