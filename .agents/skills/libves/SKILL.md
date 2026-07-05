---
name: libves
description: Guide for using libVES.subtle.js — VESvault's e2e encryption library for managing and sharing encrypted items with PKI, key exchange, redundancies, and recovery. Use when working with VES encryption, vaults, items, ciphers, or E2E key management.
user-invocable: true
---

# libVES.subtle.js

End-to-end encrypted item management using VES public key infrastructure. Keys are safeguarded from loss by VES redundancies and recovery.

## Setup

```html
<script src="https://ves.host/pub/libVES.js"></script>
```

Or via npm: `npm i libves`

Source: https://github.com/vesvault/libVES

## Vault

```js
let vault = libVES.subtle(vesDomain) // "" for default, "demo" for shared demo, "x-*" for experimental
```

### Unlock

```js
await vault.unlock()                    // interactive browser popup
await vault.unlock(credentialUri)       // local credentials
await vault.anonymous(passPhrase)       // anonymous vault from passphrase
let ok = await vault.unlocked()         // check status
```

### Items & Vaults

```js
let items = await vault.items()         // all items in vault
let item = vault.item(itemId)           // item by ID
let item = vault.item()                 // new auto-ID item
let subVaults = await vault.vaults()    // dependent vaults
let subVault = vault.vault(vaultId)     // vault instance by ID/email/URI
```

### Event Tracking

```js
await vault.start()        // future events only
await vault.start(0)       // all history
await vault.start(false)   // short history of current items
vault.stop()
```

### Vault Properties (populated by unlock/verify/item.share)

- `vault.current` — vault exists and is not lost
- `vault.owner` — owned by unlocked vault
- `vault.admin` — has admin permission on item

### Identity & Locking

```js
vault.uri()     // full VES URI
vault.short()   // short domain-specific ID
vault.lock(tmOut)  // auto-lock after tmOut seconds
vault.lock()       // lock immediately
```

### Verify & Password

```js
let vault = await subVault.verify()  // resolves, populates current/owned
let passwordItem = await vault.password()  // item storing VESkey
```

## Item

### Value

```js
await item.put(itemValue)    // store e2e encrypted
let val = await item.get()   // retrieve decrypted
```

### Sharing

```js
await item.add(vaultIds)        // add shares, keep existing
await item.remove(vaultIds)     // remove shares
await item.share(vaultIds)      // replace all shares (auto-includes current)
let shares = await item.share() // list shared vaults
let share = await item.shareFor(vaultId)  // null if not shared
```

### Lifecycle

```js
let exists = await item.exists()
await item.delete()
let readable = await item.readable()
let writable = await item.writable()
```

### Event Tracking

```js
await item.start()        // future only
await item.start(0)       // full history
await item.start(false)   // short history of current shares
item.stop()
```

### Identity

```js
item.uri()     // full VES URI
item.short()   // short domain-specific ID
```

## ItemCipher

Stream cipher for arbitrary data. Key stored e2e encrypted in VES. Default algo: AES256GCM1K.

```js
let cipher = await item.cipher()
let cipherText = await cipher.encrypt(plainText)
let plainText = await cipher.decrypt(cipherText)
await cipher.meta({ myValue: '' })  // store metadata
let meta = await cipher.meta()       // retrieve metadata
```

Accepts: ArrayBuffer, Uint*Array, Int*Array, Blob, string. String ciphertext is Base64.

## CustomEvent

### Event Types

| Type | Description |
|------|-------------|
| `authexpire` | Vault about to lock — extend with `vault.lock(tmOut)` |
| `vaultcreate` | Vault created |
| `vaultadd` | Passphrase item shared with vault |
| `vaultremove` | Passphrase item unshared from vault |
| `itemcreate` | Item created |
| `itemadd` | Item shared with vault |
| `itemremove` | Item unshared from vault |
| `itemdelete` | Item deleted |
| `itemchange` | Item value changed (real-time only, not guaranteed stored) |
| `olditemadd` | Historical item shared |
| `olditemremove` | Historical item unshared |
| `sessioncreate` | Vault unlocked, new session |

### Event Detail

- `vesEvent.type` — event type string
- `vesEvent.detail.item` — Item (for `item*` / `olditem*`)
- `vesEvent.detail.share` — Vault shared/unshared with (for `*add` / `*remove`)
- `vesEvent.detail.vault` — Vault acted on (for `vault*` / `authexpire`)
- `vesEvent.detail.author` — Author session
- `vesEvent.detail.session` — Subject session (for `session*`)
- `vesEvent.detail.id` — Numeric event ID (absent on provisional)
- `vesEvent.detail.at` — Timestamp Date (absent on provisional)
- `vesEvent.detail.replay` — true if provisional/replayed event

## Author (Session)

- `vesSession.sessid` — numeric session ID
- `vesSession.vault` — authorized vault
- `vesSession.remote` — IPv4/IPv6 address
- `vesSession.userAgent` — user agent string
