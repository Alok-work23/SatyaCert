"""
Grant or revoke the SatyaCert admin role.

The admin role is a Firebase custom claim, so it can only be set from a trusted
machine holding the service-account key — never from the browser.

Usage:
    python set_admin.py admin@example.gov.in            # grant
    python set_admin.py admin@example.gov.in --revoke   # revoke

The user must already exist in Firebase Authentication (create them in the
Firebase console → Authentication → Add user). They must sign in again for
the change to take effect.
"""
import argparse

from dotenv import load_dotenv
from firebase_admin import auth

from auth import init_firebase


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("email")
    parser.add_argument("--revoke", action="store_true", help="remove the admin role")
    args = parser.parse_args()

    load_dotenv()
    init_firebase()

    user = auth.get_user_by_email(args.email)
    claims = dict(user.custom_claims or {})
    if args.revoke:
        claims.pop("admin", None)
    else:
        claims["admin"] = True
    auth.set_custom_user_claims(user.uid, claims or None)
    # Force existing sessions to re-authenticate so the new role applies immediately
    auth.revoke_refresh_tokens(user.uid)

    print(f"{'Revoked' if args.revoke else 'Granted'} admin role for {args.email} (uid {user.uid}).")


if __name__ == "__main__":
    main()
