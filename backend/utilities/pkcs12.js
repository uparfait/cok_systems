const crypto = require('crypto')
const forge = require('node-forge')

// Opens an uploaded .p12/.pfx with the holder's password and reads the signing certificate inside it.
// node-forge only unpacks the container here; the private key is read for its checks and then dropped.

const MIN_RSA_MODULUS_BITS = 2048

const readField = (name, entity) => {
    const field = entity.getField(name)
    return field && field.value ? String(field.value).trim() : ''
}

// Prefer the rfc822Name SAN over the deprecated emailAddress RDN
const readCertificateEmail = (certificate) => {
    const san = certificate.getExtension('subjectAltName')
    if (san && Array.isArray(san.altNames)) {
        const entry = san.altNames.find((alt) => alt.type === 1 && alt.value)
        if (entry) return String(entry.value).trim()
    }
    return readField('E', certificate.subject)
}

const extractPrivateKey = (p12) => {
    const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const shroudedBag = (shrouded[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0]
    if (shroudedBag && shroudedBag.key) return shroudedBag.key
    const plain = p12.getBags({ bagType: forge.pki.oids.keyBag })
    const plainBag = (plain[forge.pki.oids.keyBag] || [])[0]
    return plainBag && plainBag.key ? plainBag.key : null
}

// The container may hold the whole chain, so pick the certificate whose key matches
const findLeafCertificate = (p12, privateKey) => {
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const entries = bags[forge.pki.oids.certBag] || []
    if (entries.length === 0) return null
    const matching = entries.find(
        (entry) => entry.cert && entry.cert.publicKey && entry.cert.publicKey.n && entry.cert.publicKey.n.equals(privateKey.n),
    )
    return (matching || entries[0]).cert
}

const isCertificateAuthority = (certificate) => {
    const basic = certificate.getExtension('basicConstraints')
    return !!(basic && basic.cA)
}

const parseWithPassword = (asn1, password) => {
    try {
        return { p12: forge.pkcs12.pkcs12FromAsn1(asn1, password) }
    } catch (error) {
        const message = String((error && error.message) || '')
        if (/mac could not be verified|invalid password|Unable to decrypt|Cannot read encrypted/i.test(message)) {
            return { error: 'Wrong password for this certificate file. The certificate was not saved.' }
        }
        return { error: 'This file could not be opened as a digital certificate.' }
    }
}

/**
 * Returns { identity } when the PFX opens with the password and holds a usable RSA signing certificate,
 * otherwise { error } with a message safe to send back to the holder.
 */
const openPkcs12 = (pfxBuffer, password) => {
    let asn1
    try {
        asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')))
    } catch {
        return { error: 'This file could not be opened as a digital certificate.' }
    }

    // Some exporters write an empty password as null rather than ''
    let opened = parseWithPassword(asn1, password)
    if (opened.error && !password) opened = parseWithPassword(asn1, null)
    if (opened.error) return opened

    const privateKey = extractPrivateKey(opened.p12)
    if (!privateKey) return { error: 'No private key was found in this certificate file.' }
    if (!privateKey.n) return { error: 'Only RSA certificates are supported for signing.' }
    if (privateKey.n.bitLength() < MIN_RSA_MODULUS_BITS) return { error: 'The certificate key is too weak.' }

    const certificate = findLeafCertificate(opened.p12, privateKey)
    if (!certificate) return { error: 'No certificate was found in this file.' }
    if (isCertificateAuthority(certificate)) return { error: 'A certificate authority certificate cannot be used to sign.' }

    const now = new Date()
    if (certificate.validity.notAfter < now) return { error: 'This certificate has expired.' }
    if (certificate.validity.notBefore > now) return { error: 'This certificate is not valid yet.' }

    const certificateDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes(), 'binary')

    return {
        identity: {
            subjectCommonName: readField('CN', certificate.subject),
            subjectEmail: readCertificateEmail(certificate),
            issuerCommonName: readField('CN', certificate.issuer),
            serialNumber: String(certificate.serialNumber || '').replace(/^0+/, ''),
            thumbprint: crypto.createHash('sha256').update(certificateDer).digest('hex'),
            validFrom: certificate.validity.notBefore,
            validTo: certificate.validity.notAfter,
        },
    }
}

// Same person even when the certificate orders the names differently, mirrors em_backend namesMatch
const namesMatch = (a, b) => {
    const clean = (value) => String(value || '').normalize('NFC').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
    const left = clean(a)
    const right = clean(b)
    if (!left || !right) return false
    if (left === right) return true
    return left.split(' ').sort().join(' ') === right.split(' ').sort().join(' ')
}

module.exports = { openPkcs12, namesMatch }
