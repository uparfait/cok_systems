const { ObjectId } = require("mongodb");

/**
 * Returns true when the given value can be interpreted as a Mongo ObjectId.
 */
function is_valid_object_id(value) {
  return !!value && ObjectId.isValid(value.toString());
}

/**
 * Converts a string to an ObjectId, returning null instead of throwing when
 * the value is not a valid identifier.
 */
function to_object_id(value) {
  if (!is_valid_object_id(value)) return null;
  return new ObjectId(value.toString());
}

module.exports = {
  is_valid_object_id,
  to_object_id,
  ObjectId,
};
