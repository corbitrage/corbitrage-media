# Partner Register (internal prototype)

Local-only compliance register for GroMo, Choice Connect and future partners.

- Lives outside `website/`, so Cloudflare Pages (output dir `website`) never publishes it.
- Open the file directly in a browser. No server, login or network calls.
- State is stored in that browser's localStorage only. Not secure, not shared, not an audit trail.
- Stores no PAN, bank, Aadhaar or customer data. Referral URLs are reduced to host name.
- Every referral link defaults to disabled. Approval inside this tool changes the register only; it never edits the website.
- Before any real admin use, this needs authenticated hosting (e.g. Cloudflare Access) and a server-side store.
