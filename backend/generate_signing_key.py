"""
Create the Ed25519 key that signs certificate QR codes.

Usage:
    python generate_signing_key.py                 # writes ./signing-key.pem
    python generate_signing_key.py path/to/key.pem

Then set SIGNING_KEY_PATH in backend/.env. Keep the file secret and backed up:
if it is lost, every QR code issued so far stops verifying; if it leaks,
anyone can forge QR codes, so generate a new one and re-issue.
"""
import os
import sys

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "signing-key.pem"
    if os.path.exists(path):
        sys.exit(f"{path} already exists; refusing to overwrite (that would invalidate issued QR codes).")

    pem = Ed25519PrivateKey.generate().private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    )
    with open(path, "wb") as f:
        f.write(pem)
    print(f"Wrote {path}. Set SIGNING_KEY_PATH={path} in backend/.env")


if __name__ == "__main__":
    main()
