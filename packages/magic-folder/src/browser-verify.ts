/**
 * The receipt verifier that runs in a browser (receipt.html and the public
 * verify page). It is plain JavaScript in a string so it can be inlined into
 * a self-contained page and needs no network.
 *
 * It must produce exactly the bytes @agent-receipts/crypto signs:
 * - v2: deep canonical JSON of every field except signature + verify_url
 * - v1: flat canonical JSON of the 12 SignablePayload fields
 *
 * Uses WebCrypto Ed25519 (Chrome 137+, Safari 17+, Firefox 129+, Node 20+).
 * The test suite runs this exact string in Node against receipts signed by
 * the real signer, so the two can't drift apart unnoticed.
 */
export const BROWSER_VERIFY_JS = String.raw`
var AR_V1_FIELDS = ['receipt_id','chain_id','receipt_type','agent_id','org_id','action','input_hash','output_hash','status','timestamp','completed_at','environment'];
var AR_UNSIGNED = ['signature','verify_url'];
function arSortDeep(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(arSortDeep);
  var out = Object.create(null); var keys = Object.keys(v).sort();
  for (var i = 0; i < keys.length; i++) { var x = v[keys[i]]; if (x !== undefined) out[keys[i]] = arSortDeep(x); }
  return out;
}
function arHex(h) {
  if (typeof h !== 'string' || h.length % 2 || /[^0-9a-f]/i.test(h)) throw new Error('bad hex');
  var b = new Uint8Array(h.length / 2);
  for (var i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
  return b;
}
function arToHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
function arB64(s) { var bin = atob(s); var b = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
function arMessage(r) {
  if (r.sig_version === 2) {
    var p = Object.create(null); Object.keys(r).forEach(function (k) { if (AR_UNSIGNED.indexOf(k) === -1 && r[k] !== undefined) p[k] = r[k]; });
    return JSON.stringify(arSortDeep(p));
  }
  var f = {}; AR_V1_FIELDS.forEach(function (k) { f[k] = r[k]; });
  return JSON.stringify(f, AR_V1_FIELDS.slice().sort());
}
async function arKeyId(publicKeyHex) {
  var d = await crypto.subtle.digest('SHA-256', arHex(publicKeyHex));
  return 'key_' + arToHex(d).slice(0, 16);
}
async function arVerify(receipt, publicKeyHex, opts) {
  opts = opts || {};
  var res = { valid: false, sig_version: receipt && receipt.sig_version === 2 ? 2 : 1, covers_all_fields: false, key_id: null, key_id_matches: null, reason: '' };
  try {
    if (!receipt || typeof receipt.signature !== 'string' || receipt.signature.indexOf('ed25519:') !== 0) { res.reason = 'No signature on this receipt.'; return res; }
    if (opts.requireV2 && res.sig_version !== 2) { res.reason = 'This is an older receipt format that only signs 12 core fields.'; return res; }
    var key = await crypto.subtle.importKey('raw', arHex(publicKeyHex), { name: 'Ed25519' }, false, ['verify']);
    var ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, arB64(receipt.signature.slice(8)), new TextEncoder().encode(arMessage(receipt)));
    res.valid = !!ok;
    res.covers_all_fields = res.sig_version === 2;
    res.key_id = await arKeyId(publicKeyHex);
    if (typeof receipt.key_id === 'string') res.key_id_matches = receipt.key_id === res.key_id;
    if (res.key_id_matches === false) res.valid = false;
    res.reason = res.valid ? '' : (res.key_id_matches === false ? 'Signed with a different key than this receipt names.' : 'The receipt was changed after it was signed, or the key is wrong.');
  } catch (e) {
    res.valid = false;
    res.reason = /Ed25519|algorithm|NotSupported/i.test(String(e && (e.name + e.message))) ? 'This browser can\'t check Ed25519 signatures. Try a current Chrome, Safari or Firefox.' : 'Could not check this receipt.';
  }
  return res;
}
`
