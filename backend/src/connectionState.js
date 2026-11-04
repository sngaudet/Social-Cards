// Consent must exist in a collection that clients could never write, including
// before this release. A version field on legacy client-writable data is insufficient.
function matchingAuthorization(record, authorization, requestField) {
  return (
    record?.authorizationVersion === 1 &&
    typeof authorization?.requestId === "string" &&
    record[requestField] === authorization.requestId &&
    Array.isArray(record.users) &&
    record.users.length === 2 &&
    Array.isArray(authorization.users) &&
    authorization.users.length === 2 &&
    record.users[0] !== record.users[1] &&
    [...record.users].sort().join("\u0000") ===
      [...authorization.users].sort().join("\u0000")
  );
}
function authorizedConnection(connection, authorization) {
  return matchingAuthorization(connection, authorization, "requestId");
}
function authorizedRelationship(relationship, authorization) {
  return (
    relationship?.status === "accepted" &&
    matchingAuthorization(relationship, authorization, "latestRequestId")
  );
}
module.exports = { authorizedConnection, authorizedRelationship };
