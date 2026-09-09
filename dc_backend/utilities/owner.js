/**
 * Owner identity is internal routing data: it decides access and ownership
 * transfer on the server, but the raw creator fields never travel to the
 * frontend. Detail endpoints that need to display an owner add back an
 * explicit owner_name plus viewer flags instead.
 */

function strip_creator(document) {
  if (!document || typeof document !== "object") return document;
  const { created_by, created_by_name, ...safe } = document;
  return safe;
}

function strip_creator_list(documents) {
  return (documents || []).map((document) => strip_creator(document));
}

module.exports = {
  strip_creator,
  strip_creator_list,
};
