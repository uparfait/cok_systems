const crypto = require('crypto');
const JSZip = require('jszip');

/**
 * Reads the zip an administrator uploads from the Deployment Management
 * page and says whether it is a usable SSL certificate set.
 *
 * The contract is three PEM text files, told apart by CONTENT, never by
 * name: one private key ("BEGIN ... PRIVATE KEY"), one site certificate
 * (the leaf, whose public key belongs to that private key) and one CA
 * chain (one or more certificates). Anything else is refused with a
 * sentence the page can show. Nothing here touches the server: the agent
 * on the host (deploy/certificate.sh) does the installing and checks the
 * same things again with openssl.
 */

const MAX_MEMBER_BYTES = 512 * 1024;

const KEY_BLOCK = /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g;
const CERT_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
const ENCRYPTED_KEY = /-----BEGIN ENCRYPTED PRIVATE KEY-----|Proc-Type: 4,ENCRYPTED/;

/** PEM is base64 text: every byte printable ASCII or ordinary whitespace. */
function is_text(buffer) {
    for (let i = 0; i < buffer.length; i += 1) {
        const byte = buffer[i];
        if (byte === 9 || byte === 10 || byte === 13) continue;
        if (byte < 32 || byte > 126) return false;
    }
    return true;
}

/** Zip files start with "PK". Anything else is refused before it is parsed. */
function looks_like_zip(buffer) {
    return Buffer.isBuffer(buffer) && buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

/**
 * The files inside the zip as { name, data }. Folders and the resource
 * forks macOS adds under __MACOSX are not files the administrator meant to
 * send, so they are skipped rather than counted against the three.
 */
async function list_members(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const members = [];
    const names = Object.keys(zip.files).sort();
    for (const name of names) {
        const entry = zip.files[name];
        if (entry.dir) continue;
        if (name.startsWith('__MACOSX/') || name.split('/').pop().startsWith('._')) continue;
        const data = await entry.async('nodebuffer');
        members.push({ name, data });
    }
    return members;
}

/** What one file holds, or why it cannot be used. */
function classify_member(member) {
    const short = member.name.split('/').pop();
    if (member.data.length === 0) return { name: short, problem: 'is empty.' };
    if (member.data.length > MAX_MEMBER_BYTES) return { name: short, problem: 'is far larger than any PEM file; it is not a certificate or a key.' };
    if (!is_text(member.data)) {
        return { name: short, problem: 'is not a text (PEM) file. DER and other binary formats are not accepted: export the key and the certificates as PEM, base64 text between BEGIN and END lines.' };
    }
    const text = member.data.toString('utf8');
    if (ENCRYPTED_KEY.test(text)) {
        return { name: short, problem: 'holds a password-protected private key. nginx cannot read it at start-up; export the key without a passphrase.' };
    }
    const keys = text.match(KEY_BLOCK) || [];
    const certs = text.match(CERT_BLOCK) || [];
    if (keys.length === 0 && certs.length === 0) {
        return { name: short, problem: 'holds no PEM block: no "BEGIN PRIVATE KEY" and no "BEGIN CERTIFICATE" line was found in it.' };
    }
    return { name: short, keys, certs, problem: null };
}

/** The DNS names of a certificate, from its subjectAltName. */
function hosts_of(certificate) {
    const san = certificate.subjectAltName || '';
    return san
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.startsWith('DNS:'))
        .map((part) => part.slice(4));
}

/** One line of a distinguished name, the way the page shows it. */
function one_line(name) {
    return String(name || '').split('\n').join(', ');
}

/**
 * Works out the key, the leaf and the chain from the files of the zip.
 * Returns { error } with a sentence for the page, or
 * { summary: { subject, issuer, not_before, not_after, hosts, chain_length, files } }.
 */
function inspect_members(members) {
    if (members.length !== 3) {
        const names = members.map((member) => member.name.split('/').pop()).join(', ') || 'nothing';
        return { error: `The zip must hold exactly three files: the private key, the certificate and the CA chain. This one holds ${members.length} (${names}).` };
    }
    const classified = members.map(classify_member);
    const broken = classified.find((entry) => entry.problem);
    if (broken) return { error: `The file ${broken.name} ${broken.problem}` };

    const key_files = classified.filter((entry) => entry.keys.length > 0);
    if (key_files.length === 0) {
        return { error: 'None of the three files holds a private key (a "BEGIN PRIVATE KEY" block). The zip needs the key the certificate was issued for.' };
    }
    if (key_files.length > 1 || key_files[0].keys.length > 1) {
        return { error: 'The zip holds more than one private key. Include only the key of this certificate, in a file of its own.' };
    }
    const key_file = key_files[0];
    if (key_file.certs.length > 0) {
        return { error: `The file ${key_file.name} holds a private key and a certificate together. Keep the key in its own file, the certificate and the chain in the other two.` };
    }

    let private_key;
    try {
        private_key = crypto.createPrivateKey(key_file.keys[0]);
    } catch (error) {
        return { error: `The private key in ${key_file.name} could not be read: ${error.message}.` };
    }

    const certificates = [];
    for (const entry of classified) {
        if (entry === key_file) continue;
        for (const pem of entry.certs) {
            try {
                certificates.push({ file: entry.name, certificate: new crypto.X509Certificate(pem) });
            } catch (error) {
                return { error: `A certificate in ${entry.name} could not be read: ${error.message}.` };
            }
        }
    }

    const leaf = certificates.find((entry) => {
        try {
            return entry.certificate.checkPrivateKey(private_key);
        } catch (error) {
            return false;
        }
    });
    if (!leaf) {
        return { error: `The private key in ${key_file.name} does not belong to any certificate in the zip. Send the key that was used for this certificate request.` };
    }

    const seen = new Set([leaf.certificate.fingerprint256]);
    const chain = certificates.filter((entry) => {
        const print = entry.certificate.fingerprint256;
        if (seen.has(print)) return false;
        seen.add(print);
        return true;
    });
    if (chain.length === 0) {
        return { error: 'The zip holds no CA chain: besides the site certificate there must be a file with the intermediate certificate(s) of the issuer.' };
    }

    const not_after = new Date(leaf.certificate.validTo);
    if (Number.isFinite(not_after.getTime()) && not_after.getTime() < Date.now()) {
        return { error: `The certificate expired on ${not_after.toISOString().slice(0, 10)}. Upload a current one.` };
    }

    return {
        summary: {
            subject: one_line(leaf.certificate.subject),
            issuer: one_line(leaf.certificate.issuer),
            not_before: new Date(leaf.certificate.validFrom).toISOString(),
            not_after: not_after.toISOString(),
            hosts: hosts_of(leaf.certificate),
            chain_length: chain.length,
            files: { key: key_file.name, certificate: leaf.file, chain: chain.map((entry) => entry.file).filter((name, index, all) => all.indexOf(name) === index) },
        },
    };
}

/**
 * The whole check for an uploaded buffer: { error } or { summary }.
 * A file that is not a zip at all is told apart from a zip with the wrong
 * content, since the fixes are different.
 */
async function inspect_certificate_zip(buffer) {
    if (!looks_like_zip(buffer)) {
        return { error: 'That file is not a zip archive. Put the private key, the certificate and the chain (three PEM files) into one .zip and upload that.' };
    }
    let members;
    try {
        members = await list_members(buffer);
    } catch (error) {
        return { error: `The zip could not be opened: ${error.message}.` };
    }
    return inspect_members(members);
}

module.exports = { inspect_certificate_zip, inspect_members, classify_member, looks_like_zip, hosts_of };
